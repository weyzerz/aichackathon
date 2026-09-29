import Link from "next/link";
import { sql } from "@/lib/db";
import type { Person } from "@/lib/types";
import ResetButton from "./reset-button";

export const dynamic = "force-dynamic";

const GROUPS: { label: string; match: (p: Person) => boolean }[] = [
  { label: "Couple", match: (p) => p.role === "couple" },
  { label: "Maid of Honor", match: (p) => p.role === "delegate" },
  { label: "Bridesmaids", match: (p) => p.role === "member" },
];

export default async function Home() {
  const people = (await sql`
    select id, name, role, title, venmo from people
    order by case role when 'couple' then 0 when 'delegate' then 1 else 2 end, name`) as Person[];
  const demoMode = process.env.DEMO_MODE === "true";

  return (
    <main
      className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-5 pb-10"
      style={{ paddingTop: "max(3rem, env(safe-area-inset-top))" }}
    >
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 h-16 w-16 overflow-hidden rounded-2xl shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={64} height={64} />
        </div>
        <h1 className="font-serif text-4xl tracking-tight text-[#2F3A2B]">Party Line</h1>
        <p className="mt-2 text-[#6B7A5E]">Maya &amp; Jordan&rsquo;s wedding party</p>
        <p className="mt-4 text-sm text-[#2F3A2B]/60">Who are you?</p>
      </header>

      <div className="flex flex-col gap-6">
        {GROUPS.map((g) => {
          const members = people.filter(g.match);
          if (members.length === 0) return null;
          return (
            <section key={g.label}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-[#8A9A7B]">
                {g.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {members.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/p/${p.id}`}
                      className="flex min-h-14 items-center justify-between rounded-2xl border border-[#8A9A7B]/20 bg-white px-4 py-3 shadow-sm transition active:scale-[0.99] hover:border-[#8A9A7B]/60"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6EBDF] font-serif text-lg text-[#6B7A5E]">
                          {p.name.charAt(0)}
                        </span>
                        <span>
                          <span className="font-medium text-[#2F3A2B]">{p.name}</span>
                          {p.title && <span className="text-[#2F3A2B]/60"> — {p.title}</span>}
                        </span>
                      </span>
                      <span aria-hidden className="text-[#8A9A7B]">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {demoMode && (
        <div className="mt-10 flex justify-center">
          <ResetButton />
        </div>
      )}
    </main>
  );
}
