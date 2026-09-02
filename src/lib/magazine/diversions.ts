/**
 * Something for the blank leaf.
 *
 * The issue pads with an empty page when the count comes out odd, so the
 * colophon falls on a right-hand page the way a printed one does. That leaf
 * has to exist, but it does not have to be empty — printed magazines have
 * always put something small on theirs.
 *
 * A riddle rather than anything that moves: this page is exported to PDF as
 * often as it is read on screen, and a puzzle set in type works in both. The
 * answer goes at the foot upside down, which is how these have always been
 * printed and which stops the eye taking it in on the way past.
 */

export type Riddle = { question: string; answer: string };

/** Chosen to sit alongside a travel story without belonging to any one trip. */
export const RIDDLES: Riddle[] = [
  { question: "I have cities, but no houses. Mountains, but no trees. Water, but no fish.", answer: "A map" },
  { question: "The more of me you take, the more you leave behind.", answer: "Footsteps" },
  { question: "I am always ahead of you, and you will never once reach me.", answer: "The horizon" },
  { question: "I run but never walk, I have a mouth but never speak, a bed but never sleep.", answer: "A river" },
  { question: "I can travel the whole world over without ever leaving my corner.", answer: "A stamp" },
  { question: "I am lighter than a feather, yet the strongest traveller cannot hold me for long.", answer: "Breath" },
  { question: "The more you take away from me, the larger I become.", answer: "A hole" },
  { question: "I sit in the middle of March and April, but at the start and end of neither.", answer: "The letter R" },
];

/**
 * The riddle an issue gets, decided by its title.
 *
 * Deterministic on purpose. The issue is composed again on every plate that is
 * moved or resized, and a riddle picked at random would change each time —
 * which reads as a bug rather than as a flourish. Two issues with the same
 * title get the same riddle, which nobody will ever notice.
 */
export function riddleFor(seed: string): Riddle {
  // djb2, small and stable. Nothing here needs a real hash.
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  return RIDDLES[hash % RIDDLES.length]!;
}
