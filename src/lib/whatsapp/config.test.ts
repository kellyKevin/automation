import { describe, it, expect } from "vitest";
import { whatsappConfigStatus } from "./config";

describe("whatsappConfigStatus", () => {
  it("reports nothing configured for an empty env", () => {
    const s = whatsappConfigStatus({});
    expect(s.canReceive).toBe(false);
    expect(s.canSend).toBe(false);
    expect(s.signatureEnforced).toBe(false);
    expect(s.ready).toBe(false);
    expect(s.graphVersion).toBe("v21.0");
  });

  it("is ready when the verify token, access token and phone id are set", () => {
    const s = whatsappConfigStatus({
      WHATSAPP_VERIFY_TOKEN: "vt",
      WHATSAPP_TOKEN: "t",
      WHATSAPP_PHONE_NUMBER_ID: "123",
    });
    expect(s.canReceive).toBe(true);
    expect(s.canSend).toBe(true);
    expect(s.ready).toBe(true);
    expect(s.signatureEnforced).toBe(false);
  });

  it("flags signature enforcement and honours a custom graph version", () => {
    const s = whatsappConfigStatus({
      WHATSAPP_APP_SECRET: "sec",
      WHATSAPP_GRAPH_VERSION: "v22.0",
    });
    expect(s.signatureEnforced).toBe(true);
    expect(s.graphVersion).toBe("v22.0");
  });

  it("treats blank/whitespace values as unset", () => {
    const s = whatsappConfigStatus({ WHATSAPP_TOKEN: "   ", WHATSAPP_PHONE_NUMBER_ID: "" });
    expect(s.canSend).toBe(false);
  });
});
