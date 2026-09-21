import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStaff } from "@/lib/auth/staff";
import { parseProductUpdate } from "@/lib/products/update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/products/:slug { price?, stock?, available?, imageUrl? } (staff only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await getStaff())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const parsed = parseProductUpdate(await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const product = await prisma.product
    .update({ where: { slug }, data: parsed.data })
    .catch(() => null);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json({ product });
}
