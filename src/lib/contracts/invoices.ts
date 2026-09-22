import { prisma } from "@/lib/db";
import { formatInvoiceNumber, buildInvoiceLines, invoiceTotals } from "./pricing";

const INVOICE_COUNTER = "invoice";

export type InvoiceResult =
  | { ok: true; invoiceId: string; number: string; total: number; orderCount: number }
  | { ok: false; error: string };

/**
 * Generate a DRAFT invoice for a contract customer's un-invoiced, non-cancelled
 * orders in a period. Each order becomes one reconcilable line; orders already
 * on an invoice for this contract are skipped, so re-running never double-bills.
 */
export async function generateInvoiceForContract(
  contractId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<InvoiceResult> {
  const contract = await prisma.contractCustomer.findUnique({ where: { id: contractId } });
  if (!contract) return { ok: false, error: "Contract not found" };

  const alreadyInvoiced = (
    await prisma.invoiceLine.findMany({
      where: { orderId: { not: null }, invoice: { contractId } },
      select: { orderId: true },
    })
  )
    .map((l) => l.orderId)
    .filter((id): id is string => !!id);

  const orders = await prisma.order.findMany({
    where: {
      customerId: contract.customerId,
      status: { not: "CANCELLED" },
      createdAt: { gte: periodStart, lte: periodEnd },
      ...(alreadyInvoiced.length ? { id: { notIn: alreadyInvoiced } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, number: true, total: true },
  });

  if (orders.length === 0) {
    return { ok: false, error: "No un-invoiced orders in that period" };
  }

  const lines = buildInvoiceLines(orders);
  const totals = invoiceTotals(lines);

  const invoice = await prisma.$transaction(async (tx) => {
    const counter = await tx.counter.upsert({
      where: { name: INVOICE_COUNTER },
      create: { name: INVOICE_COUNTER, value: 1 },
      update: { value: { increment: 1 } },
    });
    const number = formatInvoiceNumber(counter.value);
    return tx.invoice.create({
      data: {
        number,
        contractId,
        customerId: contract.customerId,
        periodStart,
        periodEnd,
        status: "DRAFT",
        subtotal: totals.subtotal,
        total: totals.total,
        lines: {
          create: lines.map((l) => ({
            orderId: l.orderId,
            orderNumber: l.orderNumber,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        },
      },
    });
  });

  return { ok: true, invoiceId: invoice.id, number: invoice.number, total: invoice.total, orderCount: orders.length };
}
