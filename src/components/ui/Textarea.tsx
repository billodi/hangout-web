"use client";

import type { TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export default function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[var(--radius-sm)] border border-[color-mix(in_oklab,var(--border)_80%,transparent)] " +
          "bg-[color-mix(in_oklab,var(--surface)_55%,transparent)] px-3 py-2 text-sm text-[var(--text)] " +
          "placeholder:text-[color-mix(in_oklab,var(--muted)_70%,transparent)] " +
          "transition focus:outline-none focus-visible:ring-0 focus-visible:[box-shadow:var(--ring)]",
        className,
      )}
      {...props}
    />
  );
}

