import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/contracts/:id/prices — staff: a contract's agreed price list.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const prices = await prisma.contractPrice.findMany({
    where: { contractId: id },
    orderBy: { productName: "asc" },
  });
  return NextResponse.json({ prices });
}

// POST /api/contracts/:id/prices { slug?, productName, unitPrice } — staff:
// add or update an agreed price (upsert on contract + product name).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const productName = typeof b?.productName === "string" ? b.productName.trim() : "";
  const unitPrice = Number(b?.unitPrice);
  if (!productName || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return NextResponse.json({ error: "A product name and a valid price are required" }, { status: 400 });
  }
  const slug = typeof b?.slug === "string" && b.slug.trim() ? b.slug.trim() : null;

  const price = await prisma.contractPrice.upsert({
    where: { contractId_productName: { contractId: id, productName } },
    create: { contractId: id, productName, slug, unitPrice },
    update: { slug, unitPrice },
  });
  return NextResponse.json({ price }, { status: 201 });
}

// DELETE /api/contracts/:id/prices?priceId= — staff: remove a price row.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const priceId = req.nextUrl.searchParams.get("priceId") || "";
  const ok = await prisma.contractPrice
    .delete({ where: { id: priceId, contractId: id } })
    .then(() => true)
    .catch(() => false);
  if (!ok) return NextResponse.json({ error: "Price not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
