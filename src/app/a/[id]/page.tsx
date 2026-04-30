import Link from "next/link";
import { getDb } from "@/db";
import { activities, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default async function ActivitySharePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const db = getDb();

  const [row] = await db
    .select({
      id: activities.id,
      title: activities.title,
      description: activities.description,
      location: activities.location,
      whenISO: activities.whenISO,
      type: activities.type,
      going: activities.going,
      limit: activities.limit,
      createdAt: activities.createdAt,
      creatorName: users.displayName,
    })
    .from(activities)
    .leftJoin(users, eq(activities.creatorId, users.id))
    .where(eq(activities.id, id));

  if (!row) {
    return (
      <main className="relative z-10 mx-auto w-full max-w-[900px] px-3 pb-10 pt-6 lg:px-8">
        <section className="shell-panel p-4">
          <h1 className="text-xl font-semibold" data-heading="true">
            Activity not found
          </h1>
          <Link href="/map" className="tab-chip tab-chip-active inline-flex mt-3">
            Back to map
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto w-full max-w-[900px] px-3 pb-10 pt-6 lg:px-8">
      <section className="shell-panel p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[color-mix(in_oklab,var(--muted)_75%,transparent)]">
          Shareable activity
        </p>
        <h1 className="mt-1 text-2xl font-semibold" data-heading="true">
          {row.title}
        </h1>
        <p className="mt-2 text-sm text-[color-mix(in_oklab,var(--muted)_78%,transparent)]">
          Hosted by {row.creatorName ?? "Unknown"} • {formatWhen(row.whenISO)} • {row.location}
        </p>
        <p className="mt-3 text-sm">{row.description || "No description provided."}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/map?activity=${encodeURIComponent(row.id)}`} className="tab-chip tab-chip-active">
            Open in app
          </Link>
          <Link href="/community" className="tab-chip">
            Browse community
          </Link>
        </div>
      </section>
    </main>
  );
}

