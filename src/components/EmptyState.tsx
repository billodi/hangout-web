import type { ReactNode } from "react";
import Button from "@/components/ui/Button";

export default function EmptyState({
  kicker,
  title,
  description,
  action,
}: {
  kicker?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="shell-panel p-6 sm:p-8 text-center">
      {kicker ? <p className="label-kicker">{kicker}</p> : null}
      <h2 className="mt-2 text-xl font-semibold sm:text-2xl" data-heading="true">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
        {description}
      </p>
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </section>
  );
}

export function EmptyStateButton({
  children,
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Button variant={variant} onClick={onClick}>
      {children}
    </Button>
  );
}
