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

export interface ProductCreate {
  slug: string;
  name: string;
  category: string; // produce | seedling
  origin: string; // JUJA_HUB | ELDORET_NURSERY
  unit: string;
  price: number;
  stock: number;
  available: boolean;
  variety: string | null;
  subCategory: string | null;
  description: string | null;
  imageUrl: string | null;
}

export type CreateResult =
  | { ok: true; data: ProductCreate }
  | { ok: false; error: string };

/** Turn a name into a URL-safe slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseProductCreate(input: unknown): CreateResult {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid request body" };
  const b = input as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "name is required" };

  const category = b.category === "seedling" ? "seedling" : b.category === "produce" ? "produce" : "";
  if (!category) return { ok: false, error: "category must be 'produce' or 'seedling'" };

  const unit = typeof b.unit === "string" ? b.unit.trim() : "";
  if (!unit) return { ok: false, error: "unit is required" };

  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: "price must be a number ≥ 0" };

  const stock = b.stock === undefined ? 0 : Number(b.stock);
  if (!Number.isFinite(stock) || stock < 0) return { ok: false, error: "stock must be a number ≥ 0" };

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const slug = str(b.slug) ? slugify(String(b.slug)) : slugify(name);
  if (!slug) return { ok: false, error: "could not derive a slug from the name" };

  return {
    ok: true,
    data: {
      slug,
      name,
      category,
      origin: category === "seedling" ? "ELDORET_NURSERY" : "JUJA_HUB",
      unit,
      price,
      stock,
      available: b.available === undefined ? true : b.available === true,
      variety: str(b.variety),
      subCategory: str(b.subCategory),
      description: str(b.description),
      imageUrl: str(b.imageUrl),
    },
  };
}

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
