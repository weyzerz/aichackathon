import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { personId } = (await req.json().catch(() => ({}))) as { personId?: string };
  if (!personId) {
    return NextResponse.json({ error: "personId is required" }, { status: 400 });
  }
  const rows = await sql`
    update notifications set read = true
    where person_id = ${personId} and read = false
    returning id`;
  return NextResponse.json({ ok: true, updated: rows.length });
}
