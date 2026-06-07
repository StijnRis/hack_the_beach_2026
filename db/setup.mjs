// Idempotently (re)creates the pg_trgm extension and the KNN GiST trigram
// index used by the fuzzy lookup in lib/pipeline.ts. Safe to run anytime —
// it never touches the table data, only ensures the index exists.
//
//   pnpm db:setup
//
// Uses the same @neondatabase/serverless driver (and DATABASE_URL) as the app,
// so it works with the pooler URL without psql's SSL channel-binding issues.

import { neon } from "@neondatabase/serverless";

// Load DATABASE_URL from .env (Node 20.6+) if it isn't already in the env.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(new URL("../.env", import.meta.url));
  } catch {
    // No .env file; fall through to the check below.
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (checked the environment and .env).");
  process.exit(1);
}

const sql = neon(url);

console.log("Ensuring pg_trgm extension...");
await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

console.log("Ensuring KNN GiST trigram index food_scores_name_trgm_gist...");
await sql`
  CREATE INDEX IF NOT EXISTS food_scores_name_trgm_gist
    ON food_scores USING gist (product_name gist_trgm_ops)
`;

console.log("Done. Fuzzy lookup index is ready.");
