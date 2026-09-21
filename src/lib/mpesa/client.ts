import { mpesaTimestamp, stkPassword, normalizeMsisdn } from "./format";

export interface MpesaConfig {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  transactionType: string; // CustomerPayBillOnline | CustomerBuyGoodsOnline
  callbackUrl: string;
}

export function mpesaConfigFromEnv(): MpesaConfig | null {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  if (!consumerKey || !consumerSecret || !shortcode || !passkey) return null;

  const env = process.env.MPESA_ENV || "sandbox";
  const baseUrl =
    env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const callbackUrl =
    process.env.MPESA_CALLBACK_URL ||
    `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/mpesa/callback`;

  return {
    baseUrl,
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    transactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
    callbackUrl,
  };
}

/** Obtain a short-lived Daraja access token. */
export async function getAccessToken(cfg: MpesaConfig): Promise<string> {
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString("base64");
  const res = await fetch(
    `${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) throw new Error(`M-Pesa auth failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("M-Pesa auth returned no token");
  return data.access_token;
}

export interface StkPushParams {
  amount: number;
  phone: string;
  accountRef: string;
  description?: string;
}

export interface StkPushResult {
  initiated: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
}

/**
 * Trigger an STK push (payment prompt) on the customer's phone. Returns
 * initiated=false in dry-run mode (no credentials configured) so the flow can
 * be exercised locally without Daraja.
 */
export async function stkPush(
  params: StkPushParams,
  cfg: MpesaConfig | null = mpesaConfigFromEnv(),
): Promise<StkPushResult> {
  if (!cfg) {
    console.info("[mpesa:dry-run] STK push", JSON.stringify(params));
    return { initiated: false };
  }

  const token = await getAccessToken(cfg);
  const timestamp = mpesaTimestamp();
  const msisdn = normalizeMsisdn(params.phone);

  const body = {
    BusinessShortCode: cfg.shortcode,
    Password: stkPassword(cfg.shortcode, cfg.passkey, timestamp),
    Timestamp: timestamp,
    TransactionType: cfg.transactionType,
    Amount: Math.max(1, Math.round(params.amount)),
    PartyA: msisdn,
    PartyB: cfg.shortcode,
    PhoneNumber: msisdn,
    CallBackURL: cfg.callbackUrl,
    AccountReference: params.accountRef,
    TransactionDesc: params.description ?? params.accountRef,
  };

  const res = await fetch(`${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    CheckoutRequestID?: string;
    MerchantRequestID?: string;
    errorMessage?: string;
  };
  if (!res.ok) {
    throw new Error(`STK push failed (${res.status}): ${data.errorMessage ?? "unknown"}`);
  }
  return {
    initiated: true,
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
  };
}
