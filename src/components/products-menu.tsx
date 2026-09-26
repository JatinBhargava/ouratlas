import { useEffect, useRef, type RefObject } from "react";
import { ChevronDown, Frame, LayoutGrid, LibraryBig, Newspaper, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

import { cn } from "@/lib/utils";

type Product = {
  name: string;
  blurb: string;
  icon: LucideIcon;
  /** Where it is used. Absent means it is not built yet, and it is listed without a link. */
  to?: string;
};

/**
 * What Atlas makes beyond the magazine, in the order the menu lists it. The
 * magazine itself is "Start a story", so it is not repeated here.
 *
 * Until a product is built it is named with "Soon" and no link: a menu item
 * that opens an empty page reads as a broken site, and the payment provider
 * verifying this business clicks every link it can find. Give it a `to` when
 * it ships and the badge goes with it.
 */
const PRODUCTS: Product[] = [
  { name: "One-page poster", blurb: "One page to design yourself: photos, text, shapes, fonts and colours.", icon: Frame, to: "/poster" },
  { name: "Editor in Chief", blurb: "Lay out every page yourself, page after page, from scratch or a layout.", icon: Newspaper, to: "/editor-in-chief" },
  { name: "Layout directory", blurb: "Pages other readers designed. Start from one, like it, or submit your own.", icon: LibraryBig, to: "/layouts" },
];

const PANEL_ID = "products-menu";

type TriggerProps = {
  open: boolean;
  onToggle: () => void;
  /** From which width the word is spelled out rather than only the icon shown. */
  labelFrom: "always" | "sm";
  ref: RefObject<HTMLButtonElement | null>;
};

/** The "Products" button in the nav pill. The list itself hangs below the pill; see `ProductsPanel`. */
export function ProductsTrigger({ open, onToggle, labelFrom, ref }: TriggerProps) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={PANEL_ID}
      aria-label="Products"
      title="Products"
      className={cn(
        "flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-sm transition-colors",
        open ? "bg-stone-900/5 text-stone-900" : "text-stone-600 hover:text-stone-900",
      )}
    >
      {labelFrom === "sm" && <LayoutGrid className="size-4 sm:hidden" />}
      <span className={cn(labelFrom === "sm" && "hidden sm:inline")}>Products</span>
      <ChevronDown className={cn("size-3.5 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
    </button>
  );
}

type PanelProps = {
  open: boolean;
  onClose: () => void;
  /** The trigger, so a press on it toggles rather than counting as a press outside. */
  trigger: RefObject<HTMLButtonElement | null>;
};

/**
 * The list of products, drawn outside the nav pill rather than inside it: the
 * pill clips its overflow (it has to, for the progress line along its foot),
 * and a menu inside it would be cut off at the pill's edge.
 */
export function ProductsPanel({ open, onClose, trigger }: PanelProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return;
      onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onClose();
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onClose, trigger]);

  if (!open) return null;

  return (
    <div
      ref={panel}
      id={PANEL_ID}
      className="absolute top-full left-0 mt-2 w-full max-w-md rounded-3xl border border-white/50 bg-white/90 p-2 shadow-lg shadow-black/10 backdrop-blur-md"
    >
      <p className="px-3 pt-2 pb-1 text-xs tracking-wide text-stone-500 uppercase">Products</p>
      <ul className="flex flex-col">
        {PRODUCTS.map(product => {
          const body = (
            <>
              <product.icon className="mt-0.5 size-4 shrink-0 text-stone-500" />
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium text-stone-900">
                  {product.name}
                  {!product.to && (
                    <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700 uppercase">
                      Soon
                    </span>
                  )}
                </span>
                <span className="text-xs leading-snug text-stone-500">{product.blurb}</span>
              </span>
            </>
          );
          return (
            <li key={product.name}>
              {product.to ? (
                <Link to={product.to} onClick={onClose} className="flex gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-stone-900/5">
                  {body}
                </Link>
              ) : (
                <div aria-disabled="true" className="flex cursor-default gap-3 rounded-2xl px-3 py-2.5">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
