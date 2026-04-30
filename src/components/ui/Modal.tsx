"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "./cn";

export default function Modal({
  open,
  title,
  children,
  onClose,
  size = "md",
  position = "center",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  position?: "center" | "offsetTop";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    return () => {
      window.setTimeout(() => lastFocusRef.current?.focus?.(), 0);
    };
  }, [open]);

  if (!open) return null;

  const sizes: Record<NonNullable<Parameters<typeof Modal>[0]["size"]>, string> = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
  };

  const positions: Record<NonNullable<Parameters<typeof Modal>[0]["position"]>, string> = {
    center: "items-center",
    offsetTop:
      "items-start pt-20 sm:pt-24 lg:pt-28 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-8",
  };

  return (
    <div
      className={cn("fixed inset-0 z-50 flex justify-center bg-black/40 p-3 backdrop-blur-md sm:p-6", positions[position])}
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
          "w-full max-h-[90vh] overflow-auto rounded-[var(--radius-lg)] border border-[var(--border)] " +
            "bg-[linear-gradient(145deg,color-mix(in_oklab,var(--surface)_92%,var(--accent2)_8%),color-mix(in_oklab,var(--surface)_84%,#2fc6ff_16%))] " +
            "[box-shadow:var(--shadow),var(--shadow-inset)] backdrop-blur-[var(--blur)] outline-none",
          position === "offsetTop"
            ? "max-h-[calc(100dvh-12rem-env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh-13rem)] lg:max-h-[calc(100dvh-14rem)]"
            : null,
          sizes[size],
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color-mix(in_oklab,var(--border)_75%,transparent)] px-4 py-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold" data-heading="true">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_70%,transparent)] px-2.5 py-1.5 text-xs font-semibold hover:bg-[color-mix(in_oklab,var(--surface2)_50%,transparent)]"
          >
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
