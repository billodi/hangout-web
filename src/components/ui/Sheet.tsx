"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "./cn";

export default function Sheet({
  open,
  title,
  children,
  onClose,
  height = "auto",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  height?: "auto" | "half" | "full";
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

  const heights: Record<NonNullable<Parameters<typeof Sheet>[0]["height"]>, string> = {
    auto: "max-h-[78vh]",
    half: "h-[52vh]",
    full: "h-[92vh]",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "w-full max-w-2xl rounded-t-[28px] border border-[var(--border)] " +
            "bg-[linear-gradient(145deg,color-mix(in_oklab,var(--surface)_92%,var(--accent2)_8%),color-mix(in_oklab,var(--surface)_84%,#2fc6ff_16%))] " +
            "[box-shadow:var(--shadow),var(--shadow-inset)] backdrop-blur-[var(--blur)] outline-none",
          heights[height],
        )}
      >
        <div className="px-4 pt-3">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-[color-mix(in_oklab,var(--border)_90%,transparent)]" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-base font-semibold" data-heading="true">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[color-mix(in_oklab,var(--surface2)_50%,transparent)]"
            >
              Close
            </button>
          </div>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

