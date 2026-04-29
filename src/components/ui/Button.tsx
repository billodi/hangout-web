"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export default function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border px-3.5 py-2 text-sm font-semibold transition " +
    "focus:outline-none focus-visible:ring-0 focus-visible:[box-shadow:var(--ring)] disabled:opacity-60 disabled:cursor-not-allowed";

  const sizes: Record<ButtonSize, string> = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-3.5 py-2",
    lg: "text-base px-4 py-2.5",
  };

  const variants: Record<ButtonVariant, string> = {
    primary:
      "border-[color-mix(in_oklab,var(--accent)_60%,transparent)] bg-gradient-to-b from-[color-mix(in_oklab,var(--accent)_78%,white_22%)] to-[var(--accent)] text-white shadow-[0_18px_34px_-22px_color-mix(in_oklab,var(--accent)_55%,transparent)]",
    secondary:
      "border-[color-mix(in_oklab,var(--border)_85%,transparent)] bg-[color-mix(in_oklab,var(--surface2)_56%,transparent)] text-[color-mix(in_oklab,var(--text)_92%,transparent)]",
    ghost:
      "border-[color-mix(in_oklab,var(--border)_55%,transparent)] bg-transparent text-[color-mix(in_oklab,var(--text)_92%,transparent)] hover:bg-[color-mix(in_oklab,var(--surface2)_45%,transparent)]",
    danger:
      "border-[color-mix(in_oklab,#f43f5e_55%,transparent)] bg-[color-mix(in_oklab,#f43f5e_16%,transparent)] text-[color-mix(in_oklab,#f43f5e_70%,var(--text)_30%)] hover:bg-[color-mix(in_oklab,#f43f5e_22%,transparent)]",
  };

  return <button className={cn(base, sizes[size], variants[variant], className)} {...props} />;
}

