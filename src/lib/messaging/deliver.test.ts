import { describe, it, expect } from "vitest";
import { chooseOutbound } from "./deliver";

describe("chooseOutbound", () => {
  it("sends free-form while the window is open (template or not)", () => {
    expect(chooseOutbound({ windowOpen: true, hasTemplate: false })).toBe("free_form");
    expect(chooseOutbound({ windowOpen: true, hasTemplate: true })).toBe("free_form");
  });
  it("uses a template when the window is closed and one exists", () => {
    expect(chooseOutbound({ windowOpen: false, hasTemplate: true })).toBe("template");
  });
  it("queues when the window is closed and no template applies", () => {
    expect(chooseOutbound({ windowOpen: false, hasTemplate: false })).toBe("queue");
  });
});
