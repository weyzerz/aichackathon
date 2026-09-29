import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "reset is disabled" }, { status: 403 });
  }
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 500 });
  }
  const seed = await readFile(path.join(process.cwd(), "db/seed.sql"), "utf8");
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(seed);
  } finally {
    await pool.end();
  }
  return NextResponse.json({ ok: true });
}
