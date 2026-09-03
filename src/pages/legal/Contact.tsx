import { Link } from "react-router";

import { Clause, LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

/** A reachable human, which a payment provider will check for. */
export function Contact() {
  return (
    <LegalPage
      title="Contact"
      summary="One inbox, read by a person. Billing, bugs, data requests and anything else."
    >
      <Clause heading="Email">
        <p>
          <a href={`mailto:${LEGAL.email}`} className="text-base underline underline-offset-2">
            {LEGAL.email}
          </a>
        </p>
        <p>We answer within two working days, usually sooner.</p>
      </Clause>

      <Clause heading="What to include">
        <p>
          For anything about a payment, the invoice number or the date and amount of the charge. For a bug, what you
          were doing and what happened instead — and, if the magazine came out wrong, roughly how many photographs and
          how many words were in it. That is usually enough to reproduce it.
        </p>
      </Clause>

      <Clause heading="Refunds and cancellation">
        <p>
          Both are covered on the{" "}
          <Link to="/refunds" className="underline underline-offset-2">
            refunds page
          </Link>
          . You can cancel yourself from your{" "}
          <Link to="/account" className="underline underline-offset-2">
            account page
          </Link>{" "}
          without writing to anyone.
        </p>
      </Clause>

      <Clause heading="Your data">
        <p>
          To ask for a copy of what we hold, or to have it deleted, email the same address — see the{" "}
          <Link to="/privacy" className="underline underline-offset-2">
            privacy policy
          </Link>{" "}
          for what there is. Note that your photographs and your writing are not among it: they never leave your
          browser, so there is nothing of them for us to send or delete.
        </p>
      </Clause>

      <Clause heading="Post">
        <p>
          {LEGAL.company}
          <br />
          {LEGAL.address}
        </p>
      </Clause>
    </LegalPage>
  );
}
