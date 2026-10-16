import "dotenv/config";
import { getDatabase, closeDatabase } from "../db/client";
import { seedDemo } from "../db/seed";
if (process.env.NODE_ENV === "production" || process.env.PETCARE_SEED_DEMO !== "true") throw new Error("Demo seed requires PETCARE_SEED_DEMO=true and a non-production environment");
try { await seedDemo(getDatabase()); console.log("Demo seed complete"); } finally { await closeDatabase(); }
