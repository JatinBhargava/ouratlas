import { Link } from "react-router";

import { Clause, LegalPage, Points } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

/**
 * The page a payment provider checks most closely.
 *
 * A refund policy that is vague, or that refuses refunds outright, is a common
 * reason a merchant-of-record application is turned down.
 */
export function Refunds() {
  return (
    <LegalPage
      title="Refunds and cancellation"
      summary={`If Atlas is not what you wanted, write to us within ${LEGAL.refundDays} days and we will refund you. No form, no reason required.`}
    >
      <Clause heading="The policy">
        <p>
          If you are not happy with a paid plan, email us within{" "}
          <span className="font-medium">{LEGAL.refundDays} days</span> of the charge and we will refund it in full. You
          do not have to explain why.
        </p>
        <p>
          Refunds go back to the card that paid, through our payment provider. They usually appear within 5–10 working
          days, depending on your bank.
        </p>
      </Clause>

      <Clause heading="How to ask">
        <p>
          Email{" "}
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-2">
            {LEGAL.email}
          </a>{" "}
          from the address on your account, with the invoice number or the date of the charge. We answer within two
          working days.
        </p>
      </Clause>

      <Clause heading="Cancelling">
        <Points
          items={[
            <>
              Cancel at any time from your{" "}
              <Link to="/account" className="underline underline-offset-2">
                account page
              </Link>
              , which opens the billing portal.
            </>,
            "Cancelling stops the next renewal. It does not end the period you have already paid for — your plan runs to the end of it.",
            "Nothing you have already made is affected. Issues you exported are files on your own device and stay yours.",
          ]}
        />
      </Clause>

      <Clause heading="Renewals">
        <p>
          Subscriptions renew automatically. If a renewal catches you by surprise within the first few days, write to us
          — we would rather refund it than have you feel caught out.
        </p>
      </Clause>

      <Clause heading="What we cannot refund">
        <Points
          items={[
            `Charges older than ${LEGAL.refundDays} days, unless something has gone wrong on our side — in which case ask anyway.`,
            "Accounts closed for breaking the terms of service.",
          ]}
        />
      </Clause>

      <Clause heading="If something went wrong">
        <p>
          If Atlas failed and cost you a subscription period — the export would not produce a file, the site was down —
          that is on us, and the time limit above does not apply. Tell us what happened and we will put it right.
        </p>
      </Clause>
    </LegalPage>
  );
}
