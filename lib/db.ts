import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Next.js loads .env automatically, so no `dotenv/config` import is needed here.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
