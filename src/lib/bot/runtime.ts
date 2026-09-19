import { prisma } from "@/lib/db";
import { handleTurn } from "./engine";
import { emptyDraft } from "./types";
import type { Catalog, EngineInput, OrderDraft } from "./types";
import type { ConversationStep } from "@/domain";
import type { InboundMessage } from "@/lib/whatsapp/inbound";
import { sendMessage } from "@/lib/whatsapp/client";
import type { OutboundMessage } from "@/lib/whatsapp/messages";
import {
  createOrderFromDraft,
  markCashOnDelivery,
  recordMpesaCode,
} from "@/lib/orders/service";
import { orderConfirmationMessages, teamAlertMessage } from "@/lib/orders/messages";

async function loadCatalog(): Promise<Catalog> {
  const [products, zones] = await Promise.all([
    prisma.product.findMany(),
    prisma.deliveryZone.findMany({ where: { active: true } }),
  ]);
  return {
    products: products.map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      variety: p.variety,
      unit: p.unit,
      price: p.price,
      available: p.available,
      stock: p.stock,
      origin: p.origin,
    })),
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      type: z.type,
      fee: z.fee,
      minimumOrder: z.minimumOrder,
      cutoffTime: z.cutoffTime,
    })),
  };
}

/**
 * Process one inbound WhatsApp message end to end: load state, run the pure
 * engine, persist the result, execute side effects, and send the replies.
 */
export async function processInbound(msg: InboundMessage): Promise<void> {
  if (!msg.from) return;
  const phone = msg.from;

  // Log the inbound message.
  await prisma.messageLog.create({
    data: {
      phone,
      direction: "IN",
      content: msg.text ?? msg.replyId ?? `[${msg.type}]`,
      messageType: msg.type,
    },
  });

  // Non-text media the bot can't read -> hand to a person.
  if (msg.type !== "text" && msg.type !== "interactive" && msg.type !== "button") {
    await reply(phone, [
      textMsg("Thanks! I've passed that to our team, who'll get back to you."),
    ]);
    return;
  }

  const customer = await prisma.customer.upsert({
    where: { phone },
    create: { phone, name: msg.profileName },
    update: msg.profileName ? { name: msg.profileName } : {},
  });

  const session = await prisma.conversationSession.upsert({
    where: { phone },
    create: { phone, customerId: customer.id, step: "IDLE", draft: null },
    update: { customerId: customer.id, lastActivity: new Date() },
  });

  const draft: OrderDraft = session.draft
    ? (JSON.parse(session.draft) as OrderDraft)
    : emptyDraft();

  const catalog = await loadCatalog();

  const input: EngineInput = {
    step: session.step as ConversationStep,
    draft,
    customer: {
      name: customer.name,
      defaultAddress: customer.defaultAddress,
      isReturning: !!customer.firstOrderAt,
    },
    catalog,
    text: msg.text,
    replyId: msg.replyId,
    now: new Date(),
  };

  const result = handleTurn(input);
  const replies: OutboundMessage[] = [...result.replies];

  // Execute side effects.
  for (const effect of result.effects) {
    switch (effect.type) {
      case "SAVE_CUSTOMER_NAME":
        await prisma.customer.update({
          where: { id: customer.id },
          data: { name: effect.name },
        });
        break;

      case "CREATE_ORDER": {
        const created = await createOrderFromDraft(customer.id, effect.draft);
        const paybill = process.env.MPESA_PAYBILL || "000000";
        replies.push(
          ...orderConfirmationMessages(created.number, {
            paybill,
            accountRef: created.number,
            amount: created.total,
          }),
        );
        await alertTeam(
          teamAlertMessage(
            created.number,
            created.total,
            effect.draft.customerName ?? customer.name ?? undefined,
            effect.draft.items.length,
          ),
        );
        break;
      }

      case "RECORD_MPESA_CODE": {
        const order = await latestOrder(customer.id);
        if (order) await recordMpesaCode(order.id, effect.code);
        break;
      }

      case "MARK_CASH_ON_DELIVERY": {
        const order = await latestOrder(customer.id);
        if (order) await markCashOnDelivery(order.id);
        break;
      }

      case "OPT_OUT":
        await prisma.customer.update({
          where: { id: customer.id },
          data: { optedOut: true },
        });
        break;

      case "HANDOVER":
        await alertTeam(
          textMsg(`\u{1F64B} Handover needed for ${phone}: ${effect.reason}`),
        );
        break;
    }
  }

  // Persist the new conversation state.
  await prisma.conversationSession.update({
    where: { phone },
    data: {
      step: result.step,
      draft: JSON.stringify(result.draft),
      lastActivity: new Date(),
    },
  });

  await reply(phone, replies);
}

async function latestOrder(customerId: string) {
  return prisma.order.findFirst({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
}

async function reply(phone: string, messages: OutboundMessage[]): Promise<void> {
  for (const m of messages) {
    await sendMessage(phone, m);
    await prisma.messageLog.create({
      data: {
        phone,
        direction: "OUT",
        content: describe(m),
        messageType: m.kind,
      },
    });
  }
}

async function alertTeam(message: OutboundMessage): Promise<void> {
  const team = process.env.TEAM_ALERT_WHATSAPP_NUMBER;
  if (!team) return;
  await sendMessage(team, message).catch(() => {});
}

function textMsg(body: string): OutboundMessage {
  return { kind: "text", body };
}

function describe(m: OutboundMessage): string {
  if (m.kind === "text") return m.body;
  return `${m.body} [${m.kind}]`;
}
