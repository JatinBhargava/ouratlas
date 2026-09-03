import { Link } from "react-router";

import { Clause, LegalPage, Points } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

/** The agreement between the reader and us. */
export function Terms() {
  return (
    <LegalPage
      title="Terms of service"
      summary="The agreement you accept by using Atlas. Plain language, and short, because a term nobody reads protects nobody."
    >
      <Clause heading="Who this is between">
        <p>
          Atlas is operated by {LEGAL.company}, {LEGAL.address}. Using the site means you accept these terms. If you do
          not, please do not use it.
        </p>
      </Clause>

      <Clause heading="What Atlas does">
        <p>
          Atlas turns photographs and writing you supply into a magazine issue, laid out in your browser and exported
          as a PDF. The composition happens on your own device. We provide the software; the trip, the pictures and the
          words are yours.
        </p>
      </Clause>

      <Clause heading="Your account">
        <Points
          items={[
            "You are responsible for what happens under your account and for keeping access to it secure.",
            "One person per account. Do not share sign-in details.",
            "You can close your account whenever you like, and we can close one that is being used to break these terms.",
          ]}
        />
      </Clause>

      <Clause heading="Your work stays yours">
        <p>
          You keep every right in your photographs and your writing. We claim no licence over them, and we could not
          exercise one if we did — they never reach our servers. The one exception is the text you choose to send to the
          copy desk, and that is used only to return the edit to you.
        </p>
        <p>
          You are responsible for having the right to use what you upload. Do not put photographs in Atlas that you do
          not have permission to use.
        </p>
      </Clause>

      <Clause heading="Plans and payment">
        <Points
          items={[
            <>
              Wanderer is free. Traveller and Cartographer are paid subscriptions, billed in advance for the period
              shown on the{" "}
              <Link to="/pricing" className="underline underline-offset-2">
                pricing page
              </Link>
              .
            </>,
            "Subscriptions renew automatically until cancelled. Cancelling stops the next renewal; it does not end the period you have already paid for.",
            <>
              Payments are handled by our payment provider, who is the merchant of record and issues your invoice.
              Refunds are covered by our{" "}
              <Link to="/refunds" className="underline underline-offset-2">
                refund policy
              </Link>
              .
            </>,
            "Prices can change. If they do, we tell existing subscribers before it affects them, and the change applies from the next renewal.",
          ]}
        />
      </Clause>

      <Clause heading="Fair use">
        <p>Do not use Atlas to:</p>
        <Points
          items={[
            "produce material that is unlawful where you are, or that infringes somebody else's rights;",
            "attempt to break, overload or reverse-engineer the service;",
            "resell access to it, or run it as a service for others under your own account.",
          ]}
        />
      </Clause>

      <Clause heading="What we do not promise">
        <p>
          Atlas is provided as it is. We work to keep it running and correct, but we do not promise it will be
          uninterrupted or free of faults, and we do not promise a particular result from the copy desk — it is an
          editing suggestion, not a guarantee about your prose.
        </p>
        <p>
          <span className="font-medium">Keep your own copies.</span> Because nothing is stored on our servers, we cannot
          recover your photographs, your writing or a finished issue. Closing the tab loses unexported work, and that is
          not something we can undo.
        </p>
      </Clause>

      <Clause heading="Liability">
        <p>
          Nothing here limits liability that cannot lawfully be limited. Subject to that, our total liability to you for
          any claim connected with Atlas is limited to what you paid us in the twelve months before it arose, and we are
          not liable for lost profits, lost data or indirect loss.
        </p>
      </Clause>

      <Clause heading="Ending it">
        <p>
          You can stop using Atlas at any time and cancel from your account page. We may suspend or end access if these
          terms are broken, or if we stop offering the service — in which case we will not bill you again and will
          refund the unused part of a period already paid for.
        </p>
      </Clause>

      <Clause heading="Changes to these terms">
        <p>
          We may update these terms. The date at the top says when they last changed, and account holders are told by
          email before a material change takes effect. Continuing to use Atlas afterwards means accepting the new
          version.
        </p>
      </Clause>

      <Clause heading="Governing law">
        <p>
          These terms are governed by the law of {LEGAL.jurisdiction}, and its courts have exclusive jurisdiction over
          any dispute — without affecting any protection you have as a consumer under the law where you live.
        </p>
      </Clause>

      <Clause heading="Reaching us">
        <p>
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-2">
            {LEGAL.email}
          </a>
          , or the{" "}
          <Link to="/contact" className="underline underline-offset-2">
            contact page
          </Link>
          .
        </p>
      </Clause>
    </LegalPage>
  );
}
