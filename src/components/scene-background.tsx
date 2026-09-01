/**
 * Decorative full-bleed backdrop: a risograph-style summer afternoon — flat
 * blue sky, a blossoming hedgerow, a footpath winding up through a wildflower
 * meadow, framed by foliage on both sides.
 *
 * Pure SVG + CSS, no image assets. The grain lives in its own fixed-pixel CSS
 * layer rather than inside the artwork, so the speckle stays a constant size
 * instead of stretching with the viewport — that constancy is what reads as
 * print rather than as a gradient.
 */

/** Deterministic PRNG so the foliage is identical on every render. */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

type Leaf = { cx: number; cy: number; r: number };

/** Scatters overlapping circles into an organic leafy mass. */
function canopy(seed: number, cx: number, cy: number, rx: number, ry: number, count: number, size: number): Leaf[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand());
    return {
      cx: cx + Math.cos(a) * d * rx,
      cy: cy + Math.sin(a) * d * ry,
      r: size * (0.55 + rand() * 0.75),
    };
  });
}

const LEFT_EDGE = canopy(11, 150, 636, 210, 96, 150, 26);
const LEFT_TUFT = canopy(13, 316, 726, 90, 78, 70, 22);
const RIGHT_EDGE = canopy(31, 1460, 618, 200, 104, 150, 27);
const RIGHT_TUFT = canopy(37, 1290, 716, 96, 82, 70, 23);
const HEDGE = canopy(43, 720, 730, 300, 62, 200, 30);
const HEDGE_LIT = canopy(57, 690, 704, 262, 40, 150, 17);

/** Wildflowers speckled through the meadow. */
const RAND_FLOWER = seeded(97);
const FLOWERS = Array.from({ length: 150 }, () => {
  const t = RAND_FLOWER();
  return {
    x: 300 + RAND_FLOWER() * 1050,
    y: 792 + RAND_FLOWER() * RAND_FLOWER() * 150,
    r: 2.2 + RAND_FLOWER() * 2.6,
    fill: t > 0.62 ? "#d94f36" : t > 0.34 ? "#e8a33d" : "#f0dfa0",
  };
});

/** Sparse bright flecks in the sky, as in the reference print. */
const RAND_SPARK = seeded(131);
const SPARKS = Array.from({ length: 120 }, () => ({
  x: RAND_SPARK() * 1600,
  y: RAND_SPARK() * 780,
  r: 1 + RAND_SPARK() * 1.8,
  o: 0.25 + RAND_SPARK() * 0.5,
}));

const noise = (frequency: number, octaves: number, slope: number, intercept: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='${octaves}' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='${slope}' intercept='${intercept}'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`;

export function SceneBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#eee9e0] print:hidden">
      <svg
        className="size-full dark:opacity-70"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Flat summer sky, barely paling toward the horizon. */}
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5d8dbe" />
            <stop offset="55%" stopColor="#6d9ac6" />
            <stop offset="100%" stopColor="#8fb3d2" />
          </linearGradient>

          <linearGradient id="meadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6f9038" />
            <stop offset="45%" stopColor="#4e7029" />
            <stop offset="100%" stopColor="#2b4718" />
          </linearGradient>

          <linearGradient id="path" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d9cbb8" />
            <stop offset="100%" stopColor="#b9b3a8" />
          </linearGradient>

          <filter id="soften" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="softenFar" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        <rect width="1600" height="1000" fill="url(#sky)" />

        <g fill="#ffffff">
          {SPARKS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
          ))}
        </g>

        {/* Meadow rolling up to the hedgerow. */}
        <path fill="url(#meadow)" d="M0 812 C 280 770 560 762 800 772 C 1060 782 1340 800 1600 828 L1600 1000 L0 1000 Z" />

        {/* Footpath winding up toward the gap in the hedge. */}
        <path
          fill="url(#path)"
          d="M452 1000 C 512 928 606 898 668 870 C 722 846 678 822 646 808 C 694 796 782 790 848 786 L856 800 C 792 806 710 812 674 824 C 710 840 754 860 710 886 C 648 918 566 946 536 1000 Z"
        />
        <path
          fill="#ffffff"
          opacity="0.22"
          d="M470 1000 C 528 936 616 906 672 880 C 716 860 690 836 664 822 C 700 812 776 806 840 802 L842 792 C 776 796 694 802 652 812 C 686 830 726 852 690 878 C 634 906 556 940 522 1000 Z"
        />

        {/* Wildflowers. */}
        <g filter="url(#soften)">
          {FLOWERS.map((f, i) => (
            <circle key={i} cx={f.x} cy={f.y} r={f.r} fill={f.fill} opacity="0.85" />
          ))}
        </g>

        {/* Blossoming hedgerow on the rise. */}
        <g filter="url(#softenFar)">
          <path
            fill="#3f6129"
            d="M300 812 C 340 762 420 726 520 710 C 640 690 780 686 890 700 C 1000 714 1080 748 1140 800 L1140 830 L300 830 Z"
          />
          <g fill="#3f6129">
            {HEDGE.map((l, i) => (
              <circle key={i} cx={l.cx} cy={l.cy} r={l.r} />
            ))}
          </g>
          <g fill="#8aa94c" opacity="0.85">
            {HEDGE_LIT.map((l, i) => (
              <circle key={i} cx={l.cx} cy={l.cy} r={l.r} />
            ))}
          </g>
        </g>

        {/* Foreground foliage framing the view, anchored to both corners. */}
        <g filter="url(#soften)">
          <g fill="#16300f">
            <path d="M-60 560 L340 560 L340 1060 L-60 1060 Z" />
            <path d="M1260 560 L1660 560 L1660 1060 L1260 1060 Z" />
            {LEFT_EDGE.map((l, i) => (
              <circle key={`le${i}`} cx={l.cx} cy={l.cy} r={l.r} />
            ))}
            {LEFT_TUFT.map((l, i) => (
              <circle key={`lt${i}`} cx={l.cx} cy={l.cy} r={l.r} />
            ))}
            {RIGHT_EDGE.map((l, i) => (
              <circle key={`re${i}`} cx={l.cx} cy={l.cy} r={l.r} />
            ))}
            {RIGHT_TUFT.map((l, i) => (
              <circle key={`rt${i}`} cx={l.cx} cy={l.cy} r={l.r} />
            ))}
          </g>
          {/* Sunlit leaves catching light along the top of each mass. */}
          <g fill="#3c6624" opacity="0.5">
            {LEFT_EDGE.filter((_, i) => i % 3 === 0).map((l, i) => (
              <circle key={`ll${i}`} cx={l.cx + 6} cy={l.cy - 10} r={l.r * 0.7} />
            ))}
            {RIGHT_EDGE.filter((_, i) => i % 3 === 0).map((l, i) => (
              <circle key={`rl${i}`} cx={l.cx - 6} cy={l.cy - 10} r={l.r * 0.7} />
            ))}
          </g>
        </g>

      </svg>

      {/* Ink texture, held at a constant pixel size. White speckle dominates. */}
      <div
        className="absolute inset-0 mix-blend-screen"
        style={{ backgroundImage: noise(0.9, 4, 9, -6.6), backgroundSize: "160px 160px", opacity: 0.85 }}
      />
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{ backgroundImage: noise(0.85, 4, -7, 2.1), backgroundSize: "160px 160px", opacity: 0.5 }}
      />
    </div>
  );
}
