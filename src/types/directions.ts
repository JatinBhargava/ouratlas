/**
 * Art directions: the looks a reader can ask the editor for before it makes
 * up their issue. Shared by the browser, which shows them as small covers to
 * pick from, and the API, which owns the words the editor reads.
 *
 * The browser sends only an id and, for "Your own", the reader's note. The
 * brief behind each id is read here by the server, so the prompt cannot be
 * rewritten from the page, and the note is the one free text that reaches
 * the editor — bounded by `DIRECTION_NOTE_MAX` and framed in the prompt as a
 * description of a look, never as instructions.
 *
 * Every brief is written for what the engine can actually do: pick a style or
 * design the pages from the gridded layouts, choose a palette (paper, ink,
 * accent) that passes the contrast check, choose faces, pace quotes and
 * full-bleed pages, and set the voice of the title, captions and notes. A
 * brief that asks for anything else (textures, hand lettering, a font that is
 * not offered) only teaches the editor to apologise in its notes.
 */

export type DirectionId = "editor" | "riso" | "ledger" | "album" | "gallery" | "glossy" | "nightfall" | "custom";

export type Direction = {
  id: DirectionId;
  name: string;
  /** One line under the tile, for the reader choosing by eye. */
  tagline: string;
  /** The tile's little cover: paper, ink and accent, as hex. */
  swatch: { paper: string; ink: string; accent: string };
  /** What the editor reads. Empty for "editor" (its own judgement) and "custom" (the reader's note). */
  brief: string;
};

/** The longest note a reader may write for "Your own": a paragraph, not a document. */
export const DIRECTION_NOTE_MAX = 400;

/** What the desk asks for and sends: a direction, and the reader's words when it is their own. */
export type EditorDirection = { id: DirectionId; note: string };

export const DIRECTIONS: readonly Direction[] = [
  {
    id: "editor",
    name: "Editor's choice",
    tagline: "Let the editor read the photos and decide",
    swatch: { paper: "#f4efe6", ink: "#1f1b16", accent: "#b5532c" },
    brief: "",
  },
  {
    id: "riso",
    name: "Riso zine",
    tagline: "Bright inks, loud type, cheeky captions",
    swatch: { paper: "#fff3b0", ink: "#17173a", accent: "#2848d6" },
    brief:
      "Make it look printed on a risograph: bright, playful and loud, like a zine friends pass around. Design the pages yourself unless the zine style plainly suits the photographs better. Palette: a pale, sunny paper (pale yellow, pale pink or a cool white), a near-black ink with a little blue in it, and one strong ink-drum accent deep enough to carry white text: cobalt, deep magenta or tomato red. A condensed or grotesque display face set big; a clean body face set left. Pace it hard: picture pages and quote pages close together, every spread different, at least two full-bleed pages. Captions short and cheeky, title punchy (two to four words), notes in the same breezy voice.",
  },
  {
    id: "ledger",
    name: "Ledger",
    tagline: "A financial weekly printed like a banknote",
    swatch: { paper: "#eef4f1", ink: "#0f1b2d", accent: "#1f63d6" },
    brief:
      "Set it like a financial weekly crossed with a banknote: precise, confident and numbers-forward. It suits a career, a year in review, a launch, a milestone at work, or any story full of dates and figures. Design the pages yourself. Palette: a cool, pale paper (mint, pale blue or note-paper grey), a deep navy-black ink, and one banknote colour as the accent: note blue, note green, violet or red. A high-contrast serif display face, a clean sans or transitional body set left. Prefer orderly, gridded layouts (columns, strips, checkerboards) over loose ones, with one full-bleed opener. Captions read like ledger entries: the date, place or count the story gives, then a few dry words; never invent a figure. The title can read like a business-weekly headline. Choose pull quotes that carry a number or a turning point.",
  },
  {
    id: "album",
    name: "Family album",
    tagline: "Pictures first, a few kind words under each",
    swatch: { paper: "#f7efe3", ink: "#2a211b", accent: "#9c5b3b" },
    brief:
      "Make a keepsake album: photographs first, few words to a page, the kind of book a family takes off the shelf. If the photographs are casual snapshots, the zine style with a gentle lean of 1 to 2 degrees reads like prints in an album; otherwise design the pages with generous picture pages and short text pages between. Palette warm and soft, drawn from the photographs' light. A warm serif for display and body. One or two quote pages at most. Captions gentle and personal, like a note written under a print; the title tender, never sentimental.",
  },
  {
    id: "gallery",
    name: "Gallery",
    tagline: "Quiet, spacious, a photo book from a gallery",
    swatch: { paper: "#f5f4f0", ink: "#111111", accent: "#5f6b66" },
    brief:
      "Make it a quiet photo book from a gallery shop: spacious, restrained, the photographs given room. Design the pages yourself, favouring single large pictures and full-bleed pages for the strongest images, never two full-bleed pages side by side. Palette nearly colourless: a bone or white paper, a true black ink, and a muted accent taken from the photographs. A refined serif or a grotesque display face, a quiet body face. Few pull quotes. Captions spare and factual: what and where, no jokes. A title of one or two words.",
  },
  {
    id: "glossy",
    name: "Glossy feature",
    tagline: "A big newsstand cover story",
    swatch: { paper: "#fbf7f2", ink: "#1a1416", accent: "#c8233c" },
    brief:
      "Make it a big glossy cover story from a newsstand magazine: dramatic and confident. Choose the most arresting cover, open the feature with a full-bleed page, and place pull quotes where the story peaks. Design the pages yourself unless a ready style already does this well. A strong editorial serif or condensed display face. Palette taken from the photographs, with a rich, saturated accent. Captions witty and specific, the title a headline someone would pick up.",
  },
  {
    id: "nightfall",
    name: "Nightfall",
    tagline: "Dusk colours, a literary hush",
    swatch: { paper: "#efe9df", ink: "#141626", accent: "#3b3f7a" },
    brief:
      "Give it the feel of evening: a quiet, literary issue. Choose the nocturne style if the photographs are mostly low light; otherwise design the pages with a deep dusk accent (indigo, plum or ink blue) on a soft paper. A classic serif for display and body, justified. Slow pacing: text pages and picture pages taking turns. Captions reflective and short, the title a phrase from the story.",
  },
  {
    id: "custom",
    name: "Your own brief",
    tagline: "Describe the look in your own words",
    swatch: { paper: "#ffffff", ink: "#1c1917", accent: "#78716c" },
    brief: "",
  },
];

export const DIRECTION_IDS: readonly DirectionId[] = DIRECTIONS.map(direction => direction.id);

/** The default: the editor's own judgement, which is what every issue got before directions. */
export const DEFAULT_DIRECTION: EditorDirection = { id: "editor", note: "" };

export function directionOf(id: string | undefined): Direction {
  return DIRECTIONS.find(direction => direction.id === id) ?? DIRECTIONS[0]!;
}

/**
 * The note as the editor may read it: one paragraph, control characters and
 * runs of whitespace folded, cut to length. The server runs it on whatever
 * arrives; the desk runs it too, so the counter shows what will be sent.
 */
export function cleanNote(note: string): string {
  return note
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DIRECTION_NOTE_MAX);
}
