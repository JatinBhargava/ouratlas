import { PricingSection } from "@/components/pricing-section";

/**
 * The plans on a page of their own.
 *
 * The landing page is a one-pager and pricing is one of its four anchored
 * stops, which is right for someone reading down it. It is wrong for everyone
 * arriving from somewhere else — from the account page, from a locked copy
 * desk, from an abandoned checkout — because a fragment only scrolls on a full
 * page load, so a client-side link to `/#pricing` used to land at the top of
 * the home page and leave the reader to find the plans themselves.
 *
 * A route has no such problem, and gives the plans an address worth sending
 * someone. The section stays on the home page too: this is not a replacement
 * for it, it is a destination for links that come from elsewhere.
 */
export function Pricing() {
  return <PricingSection />;
}
