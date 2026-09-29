import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL (or POSTGRES_URL) is not set");

async function main() {
  const pool = new Pool({ connectionString: url });
  const skipSchema = process.argv.includes("--seed-only");
  if (!skipSchema) await pool.query(readFileSync("db/schema.sql", "utf8"));
  await pool.query(readFileSync("db/seed.sql", "utf8"));
  const { rows } = await pool.query("select count(*)::int as n from people");
  console.log(`db ready: ${rows[0].n} people`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
