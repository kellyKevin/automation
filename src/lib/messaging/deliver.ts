// The window-aware send decision (Part 6.2). Pure so it is easy to test:
//
//   window open           -> send a free-form message
//   window closed + tmpl  -> send the matching approved template
//   window closed, no tmpl-> queue the message and alert a person

export type OutboundDecision = "free_form" | "template" | "queue";

export function chooseOutbound(opts: {
  windowOpen: boolean;
  hasTemplate: boolean;
}): OutboundDecision {
  if (opts.windowOpen) return "free_form";
  return opts.hasTemplate ? "template" : "queue";
}
