/**
 * The particulars every legal page needs, in one file.
 *
 * These are the only things in the four documents that are not statements
 * about how the software works — they are facts about a company, and nobody
 * but you knows them. They live here so filling them in is one edit rather
 * than a hunt through four files, and so a placeholder left behind is easy to
 * find.
 *
 * EVERY VALUE MARKED TODO MUST BE REPLACED BEFORE THESE PAGES GO LIVE. A
 * merchant of record reads them during verification, and a document naming
 * "[registered company name]" fails that review on sight.
 */

export const LEGAL = {
  /** TODO: the registered name that appears on your invoices. */
  company: "[registered company name]",

  /** TODO: registered address. Required by most payment providers. */
  address: "[registered address]",

  /** TODO: the country whose law governs the agreement, and its courts. */
  jurisdiction: "[country]",

  /** TODO: a real, monitored inbox. Not a personal address. */
  email: "[support email]",

  /** The site itself, which is the one thing here that is already true. */
  site: "https://ouratlas.co.in",

  /**
   * TODO: confirm the window you actually want to honour.
   *
   * Fourteen days is the common floor for digital goods sold to consumers in
   * the EU and UK, and it is what a merchant of record will expect to see
   * unless you say otherwise.
   */
  refundDays: 14,

  /**
   * The date these documents last changed.
   *
   * Update it when you change them — a policy with a stale date reads as one
   * nobody maintains, and the date is what a customer relies on when they say
   * which version they agreed to.
   */
  updated: "3 September 2026",
} as const;
