"use client";

import { useEffect } from "react";
import { cn } from "./cn";

export type ToastTone = "info" | "error";

export default function Toast({
  toast,
  onClear,
}: {
  toast: { tone: ToastTone; message: string } | null;
  onClear: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onClear, 2600);
    return () => window.clearTimeout(t);
  }, [toast, onClear]);

  if (!toast) return null;

  return (
    <div className="anim-toast fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2">
      <div
        className={cn(
          "rounded-full border px-4 py-2 text-sm font-semibold shadow-[0_18px_40px_-24px_color-mix(in_oklab,#000_55%,transparent)]",
          toast.tone === "error"
            ? "border-[color-mix(in_oklab,#f43f5e_40%,transparent)] bg-[color-mix(in_oklab,#f43f5e_22%,transparent)] text-[color-mix(in_oklab,#f43f5e_85%,white_15%)]"
            : "border-[color-mix(in_oklab,var(--accent2)_45%,transparent)] bg-[color-mix(in_oklab,var(--accent2)_22%,transparent)] text-[color-mix(in_oklab,var(--accent2)_85%,var(--text)_15%)]",
        )}
      >
        {toast.message}
      </div>
    </div>
  );
}
