"use client";

/**
 * Floating variant switcher for the palette POC (issue #62). Throwaway.
 * Deliberately styled OUTSIDE the candidate tokens — fixed light pill — so it
 * never reads as part of the design being judged.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CANDIDATES } from "./palettes";

export function VariantSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const index = Math.max(
    0,
    CANDIDATES.findIndex((c) => c.key === current),
  );

  useEffect(() => {
    function go(step: number) {
      const next =
        CANDIDATES[(index + step + CANDIDATES.length) % CANDIDATES.length]!;
      const search = new URLSearchParams(params.toString());
      search.set("variant", next.key);
      router.replace(`?${search.toString()}`, { scroll: false });
    }

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, params, router]);

  if (process.env.NODE_ENV === "production") return null;

  function href(step: number) {
    const next =
      CANDIDATES[(index + step + CANDIDATES.length) % CANDIDATES.length]!;
    const search = new URLSearchParams(params.toString());
    search.set("variant", next.key);
    return `?${search.toString()}`;
  }

  const candidate = CANDIDATES[index]!;

  return (
    <div className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2 py-1.5 text-neutral-900 shadow-lg shadow-black/50">
      <a
        href={href(-1)}
        className="rounded-full px-2.5 py-1 text-sm hover:bg-neutral-200"
        aria-label="Previous variant"
      >
        ←
      </a>
      <span className="px-2 text-sm font-medium whitespace-nowrap">
        {candidate.key} — {candidate.name}
      </span>
      <a
        href={href(1)}
        className="rounded-full px-2.5 py-1 text-sm hover:bg-neutral-200"
        aria-label="Next variant"
      >
        →
      </a>
    </div>
  );
}
