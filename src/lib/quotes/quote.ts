// Validation + mapping for a bulk / institutional quote request (Part 3).
// Pure so it is easy to test and shared by the storefront form + API.

export interface BulkQuoteData {
  organisation: string | null;
  type: string | null;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  itemsSummary: string;
  quantity: string | null;
  frequency: string | null;
  location: string | null;
  notes: string | null;
}

export type QuoteParseResult =
  | { ok: true; data: BulkQuoteData }
  | { ok: false; error: string };

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export function parseBulkQuote(input: unknown): QuoteParseResult {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid request body" };
  const b = input as Record<string, unknown>;

  const itemsSummary = str(b.productsRequired) ?? str(b.itemsSummary);
  if (!itemsSummary) return { ok: false, error: "Please list the products required" };

  const phone = str(b.phone);
  if (!phone) return { ok: false, error: "A contact phone number is required" };

  const county = str(b.county);
  const town = str(b.town);
  const location = str(b.location) ?? ([town, county].filter(Boolean).join(", ") || null);

  const notes =
    [str(b.preferredDeliveryDate) && `Preferred date: ${str(b.preferredDeliveryDate)}`, str(b.additionalInfo)]
      .filter(Boolean)
      .join(" | ") || null;

  return {
    ok: true,
    data: {
      organisation: str(b.organizationName) ?? str(b.organisation),
      type: str(b.type),
      contactPerson: str(b.contactPerson),
      phone,
      email: str(b.email),
      itemsSummary,
      quantity: str(b.estimatedQuantities) ?? str(b.quantity),
      frequency: str(b.frequencyOfSupply) ?? str(b.frequency),
      location,
      notes,
    },
  };
}
