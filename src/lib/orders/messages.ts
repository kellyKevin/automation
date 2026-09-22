import { ksh } from "@/lib/money";
import { text, buttons } from "@/lib/whatsapp/messages";
import type { OutboundMessage } from "@/lib/whatsapp/messages";
import { t, type Lang } from "@/lib/bot/i18n";
import { STATUS_LABELS, type OrderStatus } from "@/domain";

export interface PaymentDetails {
  paybill: string;
  accountRef: string; // usually the order number
  amount: number;
}

/** The three payment-choice buttons, in the customer's language. */
export function paymentButtons(lang: Lang) {
  return [
    { id: "pay_paid", title: t("btn_paid", lang) },
    { id: "pay_cod", title: t("btn_cod", lang) },
    { id: "pay_help", title: t("btn_help", lang) },
  ];
}

/** The two messages sent right after an order is confirmed & recorded. */
export function orderConfirmationMessages(
  orderNumber: string,
  payment: PaymentDetails,
  lang: Lang = "en",
): OutboundMessage[] {
  return [
    text(t("oc_received", lang, { number: orderNumber })),
    buttons(
      t("oc_pay", lang, {
        amount: ksh(payment.amount),
        paybill: payment.paybill,
        account: payment.accountRef,
      }),
      paymentButtons(lang),
    ),
  ];
}

/** Free-form reminder for an order that's still unpaid (Part 5). */
export function paymentReminderMessage(
  orderNumber: string,
  amount: number,
  paybill: string,
): OutboundMessage {
  return buttons(
    `⏰ Reminder: order ${orderNumber} is awaiting payment of ${ksh(amount)}.\n` +
      `Pay via M-Pesa Paybill ${paybill}, account ${orderNumber}, then reply with the confirmation.`,
    [
      { id: "pay_paid", title: "\u{1F4B3} I've paid" },
      { id: "pay_cod", title: "\u{1F4B5} Pay on delivery" },
      { id: "pay_help", title: "❓ Need help" },
    ],
  );
}

/** The message a customer gets when their order reaches a new status. */
export function statusUpdateMessage(
  orderNumber: string,
  status: OrderStatus,
  extra?: { rider?: string; riderPhone?: string; tracking?: string; carrier?: string; eta?: string },
): OutboundMessage | null {
  switch (status) {
    case "CONFIRMED":
      return text(`${orderNumber}: stock confirmed. Your order is being prepared. \u{1F9FA}`);
    case "PAID":
      return text(`${orderNumber}: payment received. Thank you! We're preparing your order.`);
    case "PACKED":
      return text(`${orderNumber}: your order is packed and ready. \u{1F4E6}`);
    case "OUT_FOR_DELIVERY":
      return text(
        `${orderNumber}: our rider is on the way.` +
          (extra?.rider ? ` Rider: ${extra.rider}` : "") +
          (extra?.riderPhone ? `, ${extra.riderPhone}` : ""),
      );
    case "DISPATCHED":
      return text(
        `${orderNumber}: dispatched${extra?.carrier ? ` via ${extra.carrier}` : ""}.` +
          (extra?.tracking ? ` Tracking: ${extra.tracking}.` : "") +
          (extra?.eta ? ` Expected arrival: ${extra.eta}.` : ""),
      );
    case "DELIVERED":
      return buttons(`${orderNumber}: delivered! How was your experience?`, [
        { id: "rate_great", title: "\u{1F600} Great" },
        { id: "rate_ok", title: "\u{1F642} Okay" },
        { id: "rate_poor", title: "\u{1F615} Poor" },
      ]);
    case "CANCELLED":
      return text(`${orderNumber}: your order has been cancelled. Contact us if this is unexpected.`);
    case "ON_HOLD":
      return text(`${orderNumber}: your order is on hold. We'll be in touch shortly.`);
    default:
      return null;
  }
}

/** Short label used in the team's new-order alert. */
export function teamAlertMessage(
  orderNumber: string,
  total: number,
  customerName: string | undefined,
  itemCount: number,
): OutboundMessage {
  return text(
    `\u{1F514} New order ${orderNumber}\n` +
      `Customer: ${customerName ?? "unknown"}\n` +
      `Items: ${itemCount}\nTotal: ${ksh(total)}\n` +
      `Status: ${STATUS_LABELS.NEW}`,
  );
}
