// Parse a Daraja STK push callback into a flat result. Pure + testable.

interface CallbackItem {
  Name?: string;
  Value?: string | number;
}
interface StkCallbackBody {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number | string;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: CallbackItem[] };
    };
  };
}

export interface StkResult {
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  success: boolean;
  mpesaReceipt?: string;
  amount?: number;
  phone?: string;
}

export function parseStkCallback(body: unknown): StkResult | null {
  const cb = (body as StkCallbackBody)?.Body?.stkCallback;
  if (!cb || cb.CheckoutRequestID === undefined) return null;

  const items = cb.CallbackMetadata?.Item ?? [];
  const value = (name: string): string | number | undefined =>
    items.find((i) => i.Name === name)?.Value;

  const resultCode = Number(cb.ResultCode);
  const receipt = value("MpesaReceiptNumber");
  const amount = value("Amount");
  const phone = value("PhoneNumber");

  return {
    checkoutRequestId: String(cb.CheckoutRequestID),
    resultCode,
    resultDesc: String(cb.ResultDesc ?? ""),
    success: resultCode === 0,
    mpesaReceipt: receipt !== undefined ? String(receipt) : undefined,
    amount: amount !== undefined ? Number(amount) : undefined,
    phone: phone !== undefined ? String(phone) : undefined,
  };
}
