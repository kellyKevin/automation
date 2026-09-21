import { describe, it, expect } from "vitest";
import { mpesaTimestamp, stkPassword, normalizeMsisdn } from "./format";
import { parseStkCallback } from "./callback";

describe("mpesaTimestamp", () => {
  it("is 14 digits YYYYMMDDHHmmss", () => {
    const ts = mpesaTimestamp(new Date("2026-03-07T09:05:03"));
    expect(ts).toMatch(/^\d{14}$/);
    expect(ts.slice(0, 8)).toBe("20260307");
  });
});

describe("stkPassword", () => {
  it("is base64(shortcode + passkey + timestamp)", () => {
    const pwd = stkPassword("174379", "passkey", "20260307090503");
    expect(Buffer.from(pwd, "base64").toString()).toBe("174379passkey20260307090503");
  });
});

describe("normalizeMsisdn", () => {
  it("normalises the common Kenyan formats to 2547XXXXXXXX", () => {
    expect(normalizeMsisdn("0712345678")).toBe("254712345678");
    expect(normalizeMsisdn("+254712345678")).toBe("254712345678");
    expect(normalizeMsisdn("254712345678")).toBe("254712345678");
    expect(normalizeMsisdn("712345678")).toBe("254712345678");
    expect(normalizeMsisdn("0110000000")).toBe("254110000000");
  });
});

describe("parseStkCallback", () => {
  it("parses a successful callback", () => {
    const body = {
      Body: {
        stkCallback: {
          MerchantRequestID: "m-1",
          CheckoutRequestID: "ws_CO_123",
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 1540 },
              { Name: "MpesaReceiptNumber", Value: "QGH7XT9K12" },
              { Name: "PhoneNumber", Value: 254712345678 },
            ],
          },
        },
      },
    };
    expect(parseStkCallback(body)).toEqual({
      checkoutRequestId: "ws_CO_123",
      resultCode: 0,
      resultDesc: "The service request is processed successfully.",
      success: true,
      mpesaReceipt: "QGH7XT9K12",
      amount: 1540,
      phone: "254712345678",
    });
  });

  it("parses a failed / cancelled callback", () => {
    const r = parseStkCallback({
      Body: { stkCallback: { CheckoutRequestID: "ws_CO_9", ResultCode: 1032, ResultDesc: "Cancelled by user" } },
    });
    expect(r).toMatchObject({ checkoutRequestId: "ws_CO_9", resultCode: 1032, success: false });
    expect(r?.mpesaReceipt).toBeUndefined();
  });

  it("returns null for an unrelated payload", () => {
    expect(parseStkCallback({ hello: "world" })).toBeNull();
  });
});
