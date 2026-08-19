"use client";

/**
 * Floating switcher for the chart-ramp POC (issue #63). Throwaway.
 * Styled OUTSIDE the theme tokens — a fixed light pill — so it never reads as
 * part of the design being judged. Same shape as #62's.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { RAMPS } from "./ramps";

export function Switcher({
  current,
  ranked,
  gradient,
  chrome,
}: {
  current: string;
  ranked: boolean;
  gradient: boolean;
  chrome: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const index = Math.max(
    0,
    RAMPS.findIndex((ramp) => ramp.key === current),
  );

  useEffect(() => {
    function go(step: number) {
      const next = RAMPS[(index + step + RAMPS.length) % RAMPS.length]!;
      const search = new URLSearchParams(params.toString());
      search.set("ramp", next.key);
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
    const next = RAMPS[(index + step + RAMPS.length) % RAMPS.length]!;
    const search = new URLSearchParams(params.toString());
    search.set("ramp", next.key);
    return `?${search.toString()}`;
  }

  function toggleHref(key: string, value: string, active: boolean) {
    const search = new URLSearchParams(params.toString());
    if (active) search.delete(key);
    else search.set(key, value);
    return `?${search.toString()}`;
  }

  const pill = (active: boolean) =>
    active
      ? "rounded-full bg-neutral-900 px-2 py-0.5 text-white"
      : "rounded-full px-2 py-0.5 hover:bg-neutral-200";

  const ramp = RAMPS[index]!;

  return (
    <div className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-1 rounded-2xl bg-white px-2 py-1.5 text-neutral-900 shadow-lg shadow-black/50">
      <div className="flex items-center gap-1">
        <a
          href={href(-1)}
          className="rounded-full px-2.5 py-1 text-sm hover:bg-neutral-200"
          aria-label="Previous ramp"
        >
          ←
        </a>
        <span className="px-2 text-sm font-medium whitespace-nowrap">
          {ramp.key} — {ramp.name}
        </span>
        <a
          href={href(1)}
          className="rounded-full px-2.5 py-1 text-sm hover:bg-neutral-200"
          aria-label="Next ramp"
        >
          →
        </a>
      </div>
      <div className="flex items-center gap-0.5 border-t border-neutral-200 pt-1 text-xs">
        <a href={toggleHref("ranked", "1", ranked)} className={pill(ranked)}>
          ranked bars
        </a>
        <a
          href={toggleHref("gradient", "1", gradient)}
          className={pill(gradient)}
        >
          area gradient
        </a>
        <a
          href={toggleHref("chrome", "fixed", chrome === "fixed")}
          className={pill(chrome === "fixed")}
        >
          retuned chrome
        </a>
      </div>
    </div>
  );
}
