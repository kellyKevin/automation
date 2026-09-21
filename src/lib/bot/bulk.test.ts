import { describe, it, expect } from "vitest";
import { handleTurn } from "./engine";
import { emptyDraft } from "./types";
import type { Catalog, EngineInput, OrderDraft } from "./types";
import type { ConversationStep } from "@/domain";

const catalog: Catalog = { products: [], zones: [] };

function turn(step: ConversationStep, draft: OrderDraft, msg: { text?: string; replyId?: string }) {
  const input: EngineInput = {
    step,
    draft,
    customer: { isReturning: false },
    catalog,
    text: msg.text,
    replyId: msg.replyId,
  };
  return handleTurn(input);
}

describe("bulk / institution enquiry flow", () => {
  it("gathers the details and hands over with a CREATE_BULK_QUOTE effect", () => {
    // Tap the "Bulk / institution" menu button.
    let r = turn("IDLE", emptyDraft(), { replyId: "menu_bulk" });
    expect(r.step).toBe("BULK_ORG");
    expect(r.draft.bulk).toBe(true);

    r = turn(r.step, r.draft, { text: "Green Valley School" });
    expect(r.step).toBe("BULK_ITEMS");
    expect(r.draft.bulkData?.organisation).toBe("Green Valley School");

    r = turn(r.step, r.draft, { text: "Tomatoes, Sukuma wiki, Onions" });
    expect(r.step).toBe("BULK_QUANTITY");
    expect(r.draft.bulkData?.items).toContain("Tomatoes");

    r = turn(r.step, r.draft, { text: "50kg tomatoes weekly" });
    expect(r.step).toBe("BULK_LOCATION");
    expect(r.draft.bulkData?.quantity).toBe("50kg tomatoes weekly");
    expect(r.draft.bulkData?.frequency).toBe("Weekly");

    r = turn(r.step, r.draft, { text: "Juja, Kiambu" });
    expect(r.step).toBe("HANDOVER");
    expect(r.draft.bulkData?.location).toBe("Juja, Kiambu");
    expect(r.effects).toEqual([{ type: "CREATE_BULK_QUOTE", draft: r.draft }]);
  });

  it("lets the organisation be skipped", () => {
    const start = turn("IDLE", emptyDraft(), { replyId: "menu_bulk" });
    const r = turn("BULK_ORG", start.draft, { text: "skip" });
    expect(r.step).toBe("BULK_ITEMS");
    expect(r.draft.bulkData?.organisation).toBeNull();
  });

  it("re-asks when required answers are blank, then hands over after retries", () => {
    const start = turn("IDLE", emptyDraft(), { replyId: "menu_bulk" });
    const afterOrg = turn("BULK_ORG", start.draft, { text: "ACME Ltd" });
    // First blank items answer -> re-ask.
    const retry = turn("BULK_ITEMS", afterOrg.draft, { text: "" });
    expect(retry.step).toBe("BULK_ITEMS");
    // Second blank -> handover.
    const giveUp = turn("BULK_ITEMS", retry.draft, { text: "" });
    expect(giveUp.step).toBe("HANDOVER");
  });
});
