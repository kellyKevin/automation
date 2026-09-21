// Validation for staff edits to a product (price / stock / availability /
// image). Pure so it is easy to test and shared by the API route.

export interface ProductUpdate {
  price?: number;
  stock?: number;
  available?: boolean;
  imageUrl?: string | null;
}

export type ParseResult =
  | { ok: true; data: ProductUpdate }
  | { ok: false; error: string };

export function parseProductUpdate(input: unknown): ParseResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid request body" };
  }
  const b = input as Record<string, unknown>;
  const data: ProductUpdate = {};

  if (b.price !== undefined) {
    const n = Number(b.price);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "price must be a number ≥ 0" };
    }
    data.price = n;
  }

  if (b.stock !== undefined) {
    const n = Number(b.stock);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "stock must be a number ≥ 0" };
    }
    data.stock = n;
  }

  if (b.available !== undefined) {
    if (typeof b.available !== "boolean") {
      return { ok: false, error: "available must be true or false" };
    }
    data.available = b.available;
  }

  if (b.imageUrl !== undefined) {
    if (b.imageUrl === null || b.imageUrl === "") {
      data.imageUrl = null;
    } else if (typeof b.imageUrl === "string") {
      data.imageUrl = b.imageUrl.trim();
    } else {
      return { ok: false, error: "imageUrl must be a string" };
    }
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No updatable fields provided" };
  }
  return { ok: true, data };
}
