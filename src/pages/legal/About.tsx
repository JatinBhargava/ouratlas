import { Link } from "react-router";

import { Clause, LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

/**
 * Who is behind the service.
 *
 * Deliberately about the product and how it is built rather than a founding
 * story: everything here is checkable, which is the point when the reader is
 * deciding whether to give this site a card number.
 */
export function About() {
  return (
    <LegalPage
      title="About Atlas"
      summary="A magazine press for your own trips, built so that the photographs never have to leave your hands."
    >
      <Clause heading="What it is">
        <p>
          Atlas takes the photographs from a trip and the words you write about it, and sets them as a magazine — cover,
          contents, a feature opener with a drop cap, spreads, plates and folios — which you export as a PDF and keep.
        </p>
        <p>
          The layout is not a template you fill in. The copy is measured against real type, line by line, and poured
          through the pages until it is spent, so no page overflows and none is left half empty. Photographs are spread
          evenly through the issue rather than spent all at the front.
        </p>
      </Clause>

      <Clause heading="Why it works the way it does">
        <p>
          Holiday photographs are not neutral things. They have your family in them, and the inside of your house, and
          where you were on a particular day. The ordinary way to build this would be to upload them to a server, render
          the magazine there and send back a file — and that is a copy of your year on somebody else's disk.
        </p>
        <p>
          So Atlas composes in the browser instead. Your pictures are read from your device into the tab and stay there;
          the export is produced by your own browser's print engine. There is no upload, and there is no table in our
          database that could hold one.
        </p>
        <p>
          The single exception is the copy desk, which sends the <em>text</em> of your story to be edited and sends the
          edit back. It is off until you press it, it is never given a photograph, and nothing is kept. The{" "}
          <Link to="/privacy" className="underline underline-offset-2">
            privacy policy
          </Link>{" "}
          sets that out in full.
        </p>
      </Clause>

      <Clause heading="What it costs">
        <p>
          Wanderer is free and exports a magazine. Traveller and Cartographer add longer issues and the copy desk. The{" "}
          <Link to="/pricing" className="underline underline-offset-2">
            pricing page
          </Link>{" "}
          has the detail, and you can have your money back within {LEGAL.refundDays} days without explaining yourself.
        </p>
      </Clause>

      <Clause heading="Who makes it">
        <p>
          {LEGAL.company}, {LEGAL.address}. Write to{" "}
          <a href={`mailto:${LEGAL.email}`} className="underline underline-offset-2">
            {LEGAL.email}
          </a>{" "}
          — it is read by a person.
        </p>
      </Clause>
    </LegalPage>
  );
}
