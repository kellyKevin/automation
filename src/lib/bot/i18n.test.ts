import { describe, it, expect } from "vitest";
import { detectLanguage, isStopWord, isCancelWord, isChangeWord, isYesWord, t } from "./i18n";

describe("detectLanguage", () => {
  it("detects Swahili from common words", () => {
    expect(detectLanguage("Nataka nyanya tafadhali")).toBe("sw");
    expect(detectLanguage("ndio")).toBe("sw");
    expect(detectLanguage("Habari, nataka kununua miche")).toBe("sw");
  });
  it("keeps the fallback for English or empty", () => {
    expect(detectLanguage("I'd like to order tomatoes")).toBe("en");
    expect(detectLanguage("", "sw")).toBe("sw"); // sticky
    expect(detectLanguage("hello there")).toBe("en");
  });
  it("does not flip on a stray token", () => {
    expect(detectLanguage("Tomatoes 5kg please")).toBe("en");
  });
});

describe("command words (bilingual)", () => {
  it("understands stop / cancel / change / yes in both languages", () => {
    expect(isStopWord("acha")).toBe(true);
    expect(isStopWord("stop now")).toBe(true);
    expect(isCancelWord("ghairi")).toBe(true);
    expect(isCancelWord("sitaki")).toBe(true);
    expect(isChangeWord("badilisha")).toBe(true);
    expect(isYesWord("ndio")).toBe(true);
    expect(isYesWord("sawa")).toBe(true);
    expect(isYesWord("yes please")).toBe(true);
    expect(isYesWord("no")).toBe(false);
  });
});

describe("t", () => {
  it("translates and fills variables", () => {
    expect(t("welcome", "sw")).toContain("Karibu");
    expect(t("welcome", "en")).toContain("Welcome");
    expect(t("greeting_back", "sw", { name: "Grace" })).toBe("Karibu tena, Grace! ");
    expect(t("send_list", "en", { what: "seedlings" })).toContain("seedlings list");
  });
});
