"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "./cn";

export default function Sheet({
  open,
  title,
  children,
  onClose,
  height = "auto",
  position = "default",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  height?: "auto" | "half" | "full";
  position?: "default" | "offsetTop";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const heights: Record<"auto" | "half" | "full", string> = {
    auto: "max-h-[78vh]",
    half: "h-[52vh]",
    full: "h-[92vh]",
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Full-screen scrim as its own control so taps always close (not lost to flex hit-testing). */}
      <button
        type="button"
        aria-label="Close sheet"
        className="absolute inset-0 z-0 border-0 bg-black/40 backdrop-blur-md cursor-default"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex w-full justify-center px-0 pb-[env(safe-area-inset-bottom)]",
          position === "offsetTop" ? "pt-20 sm:pt-24 lg:pt-28" : null,
        )}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            "pointer-events-auto w-full max-w-2xl rounded-t-[28px] border border-[var(--border)] " +
              "bg-[linear-gradient(145deg,color-mix(in_oklab,var(--surface)_92%,var(--accent2)_8%),color-mix(in_oklab,var(--surface)_84%,#2fc6ff_16%))] " +
              "[box-shadow:var(--shadow),var(--shadow-inset)] backdrop-blur-[var(--blur)] outline-none touch-manipulation",
            position === "offsetTop" && height === "full"
              ? "h-[calc(100dvh-12rem-env(safe-area-inset-bottom))] sm:h-[calc(100dvh-13rem)] lg:h-[calc(100dvh-14rem)]"
              : null,
            heights[height],
          )}
        >
          <div className="px-4 pt-3">
            <button
              type="button"
              className="mx-auto flex h-8 w-full max-w-[120px] flex-col items-center justify-start rounded-full pt-1"
              aria-label="Drag to close"
              onClick={onClose}
            >
              <span className="h-1.5 w-10 rounded-full bg-[color-mix(in_oklab,var(--border)_90%,transparent)]" />
            </button>
            <div className="mt-2 flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-base font-semibold" data-heading="true">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] px-3 py-2 text-sm font-semibold hover:bg-[color-mix(in_oklab,var(--surface2)_50%,transparent)] min-h-[44px] min-w-[44px]"
              >
                Close
              </button>
            </div>
          </div>
          <div
            className={cn(
              "max-h-[min(70vh,100dvh-12rem)] overflow-y-auto overscroll-contain p-4",
              position === "offsetTop"
                ? "pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-10"
                : "pb-6",
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
