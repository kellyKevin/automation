import { prisma } from "@/lib/db";
import { sendMessage, sendTemplate } from "@/lib/whatsapp/client";
import { isWindowOpen } from "@/lib/whatsapp/window";
import { chooseOutbound } from "./deliver";
import type { OutboundMessage } from "@/lib/whatsapp/messages";
import type { ResolvedTemplate } from "@/lib/whatsapp/templates";
import type { Lang } from "@/lib/bot/i18n";

type SendResult = { sent: boolean; id?: string };
const failed = (): SendResult => ({ sent: false });

export type NotifyOutcome = "free_form" | "template" | "queue" | "none";

/**
 * Send a customer notification honouring the 24-hour window (Part 6):
 *   window open           → the free-form message
 *   window closed + tmpl  → the approved template
 *   window closed, no tmpl→ queue the free-form message and (optionally) alert
 *                           the team so a person follows up.
 *
 * Every send is logged to MessageLog. Returns which path was taken.
 */
export async function notifyCustomer(opts: {
  phone: string;
  customerId?: string | null;
  lastInboundAt: Date | string | null | undefined;
  freeForm: OutboundMessage | null;
  template: ResolvedTemplate | null;
  /** Language for the approved template (defaults to English). */
  lang?: Lang;
  queueReason?: string;
  teamAlert?: string;
}): Promise<NotifyOutcome> {
  const { phone, freeForm, template } = opts;
  const decision = chooseOutbound({
    windowOpen: isWindowOpen(opts.lastInboundAt),
    hasTemplate: !!template,
  });

  if (decision === "free_form" && freeForm) {
    const res = await sendMessage(phone, freeForm).catch(failed);
    await logOut(phone, describe(freeForm), freeForm.kind, res);
    return "free_form";
  }

  if (decision === "template" && template) {
    const res = await sendTemplate(phone, template.name, template.params, opts.lang ?? "en").catch(failed);
    await logOut(phone, `template:${template.name}(${template.params.join(", ")})`, "template", res);
    return "template";
  }

  // Window closed and no matching template — queue and (optionally) alert.
  if (freeForm) {
    await prisma.outboundQueue.create({
      data: {
        phone,
        customerId: opts.customerId ?? undefined,
        reason: opts.queueReason ?? "window_closed_no_template",
        payload: JSON.stringify(freeForm),
      },
    });
    if (opts.teamAlert) {
      const team = process.env.TEAM_ALERT_WHATSAPP_NUMBER;
      if (team) await sendMessage(team, { kind: "text", body: opts.teamAlert }).catch(failed);
    }
    return "queue";
  }

  return "none";
}

function describe(m: OutboundMessage): string {
  return m.kind === "text" ? m.body : `${m.body} [${m.kind}]`;
}

async function logOut(
  phone: string,
  content: string,
  messageType: string,
  res: SendResult,
): Promise<void> {
  await prisma.messageLog.create({
    data: {
      phone,
      direction: "OUT",
      content,
      messageType,
      waMessageId: res.id,
      status: res.sent ? "sent" : null,
    },
  });
}
