// Applies pending Prisma migrations during production Vercel builds, so the
// database schema always matches the code being deployed. Preview builds
// skip it: an unmerged branch must never migrate the production database.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`[migrate] Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
  process.exit(0);
}

console.log("[migrate] Applying pending migrations to the production database…");
execSync("npx prisma migrate deploy", { stdio: "inherit" });
