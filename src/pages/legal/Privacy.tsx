import { Link } from "react-router";

import { Clause, LegalPage, Points } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

/**
 * What the service does with data.
 *
 * Written from the code rather than from a template: the claims here are
 * checkable against `src/pages/Create.tsx` (photographs and story text stay in
 * the browser), `api/routes/polish.ts`, `api/routes/transcribe.ts` and
 * `api/routes/editor.ts` (the things that leave, each only when asked), and
 * `api/schema.sql` (everything the database holds).
 */
export function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      summary="Your photographs and your writing are never stored. This page says exactly what does reach us, and what happens to it."
    >
      <Clause heading="The short version">
        <p>
          Atlas composes your magazine in your browser, and never stores your photographs or your writing. Making the
          issue and exporting it happen entirely on your device. Three things can leave it, each only when you ask:
          the text of your story, if you ask the copy desk to edit it; your voice, if you record your story rather
          than type it; and small previews of your photographs with your story, if you ask the editor to lay out the
          issue.
        </p>
      </Clause>

      <Clause heading="What never reaches us">
        <Points
          items={[
            "Your photographs. They are read from your device into the browser tab and stay there. Closing the tab discards them.",
            "Your finished magazine. It is laid out and exported by your own browser's print engine; no copy is sent to us or stored anywhere.",
            "Your card details. Payment is taken by our payment provider on their own pages; we never see or hold a card number.",
          ]}
        />
      </Clause>

      <Clause heading="What we hold, and why">
        <Points
          items={[
            <>
              <span className="font-medium">Your account.</span> If you sign in with Google we store the email address,
              name and profile picture Google gives us, so the site can greet you and tie a subscription to you.
            </>,
            <>
              <span className="font-medium">Your subscription.</span> Which plan you are on, its status, and when the
              period ends — mirrored from our payment provider so a page load does not have to ask them.
            </>,
            <>
              <span className="font-medium">Your payment history.</span> Amounts, currency, dates and invoice
              references. Not card numbers.
            </>,
            <>
              <span className="font-medium">Your email address, if you join the mailing list.</span> Nothing else, and
              you can ask us to remove it at any time.
            </>,
          ]}
        />
      </Clause>

      <Clause heading="The copy desk, which is the exception">
        <p>
          The copy desk is optional and off until you press it. When you use it, the text of your story is sent to an
          AI provider, edited, and sent back. It is not stored by us — not logged, not written to a database, not kept
          in a file — and your photographs are never part of the request.
        </p>
        <p>
          The provider processes the text to return the edit. We do not use your writing to train anything, and we do
          not permit our providers to either.
        </p>
      </Clause>

      <Clause heading="Recording your story">
        <p>
          The Speak tab is optional. While you record, your voice is streamed from your browser straight to OpenAI,
          transcribed, and the text comes back into your story as you speak; that audio never passes through our
          servers. If you upload a recording instead, it is sent through our server to OpenAI a couple of minutes at a
          time and held only in memory while each piece is transcribed. Either way, neither the audio nor the text is
          stored by us — not logged, not written to a database, not kept in a file.
        </p>
        <p>
          Your browser asks before Atlas can use the microphone, and the microphone is released the moment you press
          stop.
        </p>
      </Clause>

      <Clause heading="The editor">
        <p>
          The editor is optional and does nothing until you press it. When you do, your browser makes a small,
          low-resolution preview of each photograph — enough to see what it shows, far too small to print — and sends
          those with your story and title to an AI provider, which suggests a style, an order and a crop for your
          issue. Your full-size photographs are never sent. Nothing is stored by us: not logged, not written to a
          database, not kept in a file.
        </p>
      </Clause>

      <Clause heading="Who else is involved">
        <Points
          items={[
            <>
              <span className="font-medium">Supabase</span> — accounts and the database described above.
            </>,
            <>
              <span className="font-medium">Google</span> — only if you choose to sign in with it.
            </>,
            <>
              <span className="font-medium">Dodo Payments</span> — our merchant of record. They take the payment, issue
              the invoice and hold the card details.
            </>,
            <>
              <span className="font-medium">Vercel</span> — hosting, plus visitor counts and page-speed measurements.
              These are cookieless and do not identify you.
            </>,
            <>
              <span className="font-medium">OpenAI or Anthropic</span> — the copy desk and the editor, and only when
              you use them.
              OpenAI also transcribes recordings from the Speak tab, only while you record.
            </>,
          ]}
        />
      </Clause>

      <Clause heading="Cookies">
        <p>
          We set no advertising or tracking cookies. Signing in stores a session in your browser so you stay signed in;
          that is what it is for and it does nothing else. Our analytics do not use cookies.
        </p>
      </Clause>

      <Clause heading="How long we keep things">
        <p>
          Account and subscription records last as long as your account does. Ask us to close it and we delete them,
          except records we are required to keep for tax and accounting — invoices, principally — which we keep for as
          long as the law requires and no longer.
        </p>
      </Clause>

      <Clause heading="Your rights">
        <p>
          You can ask for a copy of what we hold about you, ask us to correct it, or ask us to delete it. Write to{" "}
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-2">
            {LEGAL.email}
          </a>{" "}
          and we will answer within 30 days. Most of what people want is on the{" "}
          <Link to="/account" className="underline underline-offset-2">
            account page
          </Link>{" "}
          already.
        </p>
      </Clause>

      <Clause heading="Children">
        <p>Atlas is not intended for children under 13, and we do not knowingly collect their data.</p>
      </Clause>

      <Clause heading="Changes">
        <p>
          If this policy changes we update the date at the top. Material changes — anything that alters what we collect
          or who we share it with — will be told to account holders by email before they take effect.
        </p>
      </Clause>

      <Clause heading="Who we are">
        <p>
          {LEGAL.company}, {LEGAL.address}. Questions to{" "}
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-2">
            {LEGAL.email}
          </a>
          .
        </p>
      </Clause>
    </LegalPage>
  );
}
