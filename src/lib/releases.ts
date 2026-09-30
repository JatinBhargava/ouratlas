/**
 * What each version brought, for readers: the What's new page (`/whats-new`)
 * and the version link in the footer.
 *
 * Written for someone making a magazine, not for whoever maintains the site.
 * No routes, settings or services; say what a person can now do, in the words
 * the rest of the site uses. The engineering record of the same versions is
 * `CHANGELOG.md`, which is where endpoints and configuration belong.
 *
 * Newest first. Add an entry with every version bump in `versions.json`; the
 * first entry is shown as the current release.
 */

export type Release = {
  version: string;
  /** As the legal pages print dates: "27 September 2026". */
  date: string;
  /** One line on what the release is about. */
  headline: string;
  items: { title: string; detail: string }[];
};

export const RELEASES: Release[] = [
  {
    version: "1.1.0",
    date: "1 October 2026",
    headline: "Hundreds of ready-made layouts, and a preview of your whole magazine.",
    items: [
      {
        title: "Atlas Studio",
        detail:
          "Over two hundred layouts drawn by our editors: one-page magazines in a dozen moods, covers, contents pages, photo plates and pull quotes. Open any page, press Use this layout, and put your own photos and words in it.",
      },
      {
        title: "Complete issues, ready to fill",
        detail:
          "Ten-page magazines from cover to colophon, each in a house style of its own, from Swiss and Gazette to Riviera, Garden and Noir. Fill every page at once and download the whole issue.",
      },
      {
        title: "Save & share from the Studio",
        detail:
          "Download a Studio page as a PDF or picture with no account, or save it for a link to send. As on the desk, your pages are sealed before they leave your browser.",
      },
      {
        title: "Preview in Editor in Chief",
        detail:
          "Press Preview to turn through every page you've made as the finished magazine: the cover on its own, then each page beside the one it faces in print. Happy with it? Download the PDF right from there.",
      },
      {
        title: "Easier on phones",
        detail:
          "Moving a photo inside its frame no longer gets stuck when your finger slips into a scroll, and the controls on each photo are bigger and always showing, so they're easy to find and tap.",
      },
      {
        title: "A page that isn't there",
        detail: "Follow a broken link and you'll find a torn cover to piece back together, and a contents page to take you somewhere that is.",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "27 September 2026",
    headline: "Atlas is coming to Android.",
    items: [
      {
        title: "An app for your phone",
        detail:
          "We're testing an Atlas app for Android, so you can make a magazine from the photos already on your phone. It will be on Google Play soon.",
      },
      {
        title: "Sign in with Google, right in the app",
        detail:
          "Choose your account and you're back where you left off, with your photos and story still on the desk.",
      },
    ],
  },
  {
    version: "0.3.0",
    date: "26 September 2026",
    headline: "Any memory, not just trips, and new ways to make pages.",
    items: [
      {
        title: "Made for any memory",
        detail:
          "Weddings, birthdays, a baby's first year or an ordinary Sunday. Atlas and its editor now write for all of them, not only for travel.",
      },
      {
        title: "One-page poster",
        detail:
          "Design a single page yourself: drop in photos, text and shapes, pick fonts and colours, and download it as a PDF or picture.",
      },
      {
        title: "Editor in Chief",
        detail: "Lay out a whole magazine by hand, page after page, starting from a ready-made layout if you like.",
      },
      {
        title: "Layouts from other readers",
        detail:
          "Browse page designs made by Atlas readers, like your favourites, start from any of them, or send in your own for the editors to review.",
      },
      {
        title: "Share to your socials",
        detail: "Send a saved magazine to WhatsApp, Instagram and more straight from Save & share.",
      },
      {
        title: "The copy desk on the free plan",
        detail: "Wanderer now gets two copy-desk edits a month, and a sample story to try Atlas with.",
      },
      {
        title: "Steadier on phones",
        detail: "If a page ever fails to load, you'll now see a way back instead of a blank screen.",
      },
    ],
  },
  {
    version: "0.2.0",
    date: "26 September 2026",
    headline: "Lower prices.",
    items: [
      {
        title: "Traveller is ₹99 and Cartographer ₹199 a month",
        detail: "Down from ₹499 and ₹1,199.",
      },
      {
        title: "Monthly allowances for the editor and the copy desk",
        detail: "Each plan now comes with a set number of editor designs and copy-desk edits every month.",
      },
      {
        title: "Up to ten photos an issue",
        detail: "The number the layouts are designed around, so every photo gets a proper place.",
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2 September 2026",
    headline: "The first issue of Atlas.",
    items: [
      {
        title: "Your photos and words, set as a magazine",
        detail:
          "Add up to ten photos and your story, and Atlas sets it as a proper magazine: cover, contents, the feature, full-page photos and page numbers.",
      },
      {
        title: "Download it as a PDF",
        detail: "Keep it, print it, or send it to someone. Your photos never leave your device.",
      },
      {
        title: "The editor",
        detail: "Let Atlas choose the look, the cover, the order of your photos and the captions. One tap undoes it.",
      },
      {
        title: "The copy desk",
        detail: "Have your story tidied up, or turned from notes into a finished piece.",
      },
      {
        title: "Speak instead of typing",
        detail: "Tell your story out loud, or upload a voice note, and the words appear in the Write box.",
      },
      {
        title: "Save & share",
        detail:
          "Save a magazine and send it as a link. It's locked so that only people with the link can open it, and My magazines keeps your saved issues together.",
      },
      {
        title: "Pictures for Instagram and WhatsApp",
        detail: "Every page as a picture sized for sharing.",
      },
      {
        title: "Design your own pages",
        detail: "Move boxes around on any page, or draw a layout of your own.",
      },
    ],
  },
];
