// The WhatsApp 24-hour customer service window (Part 6 of the plan).
//
// When a customer messages the business, a 24-hour window opens during which
// the bot may send free-form messages. Each new customer message restarts it.
// Outside the window, only pre-approved templates may be sent.

export const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Is the 24-hour service window still open, given the customer's last inbound
 * message time? A customer who has never messaged has no open window. */
export function isWindowOpen(
  lastInboundAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastInboundAt) return false;
  const last = new Date(lastInboundAt).getTime();
  if (Number.isNaN(last)) return false;
  return now.getTime() - last < WINDOW_MS;
}

/** Milliseconds until the window closes (0 if already closed). */
export function windowRemainingMs(
  lastInboundAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  if (!lastInboundAt) return 0;
  const last = new Date(lastInboundAt).getTime();
  if (Number.isNaN(last)) return 0;
  return Math.max(0, last + WINDOW_MS - now.getTime());
}
