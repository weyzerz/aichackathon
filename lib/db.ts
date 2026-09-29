import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL (or POSTGRES_URL) is not set");

// Tagged-template client: sql`select * from people where id = ${id}`
// For dynamic SQL strings use sql.query(text, params).
export const sql = neon(url);
