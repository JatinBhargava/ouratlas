import { expect, test } from "bun:test";
import { paragraphsHtml } from "./copy";

const accent = (text: string) => `<span style="color:var(--ink-accent)">${text}</span>`;

test("punctuation accents preserve escaped quotes and ampersands", () => {
  const html = paragraphsHtml({ lines: [{ text: `We didn't go. Tom & Jerry said "hi"`, continued: false }] }, { punctuation: true });
  expect(html).toContain(`We didn&#39;t go${accent(".")} Tom ${accent("&amp;")} Jerry said &quot;hi&quot;`);
  expect(html).not.toContain(`${accent("&")}#39;`);
});

test("punctuation mode still escapes markup and literal entity text", () => {
  const html = paragraphsHtml({ lines: [{ text: `<script>&amp;</script>.`, continued: false }] }, { punctuation: true });
  expect(html).toContain(`&lt;script&gt;${accent("&amp;")}amp;&lt;/script&gt;${accent(".")}`);
  expect(html).not.toContain("<script>");
});

test("plain copy keeps escaping unchanged", () => {
  expect(paragraphsHtml({ lines: [{ text: `a & b's "quote" <x>`, continued: false }] })).toContain("a &amp; b&#39;s &quot;quote&quot; &lt;x&gt;");
});
