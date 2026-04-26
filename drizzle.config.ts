import type { Config } from "drizzle-kit";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
const envFile = resolve(__dirname, ".env.local");
try {
  const envContent = readFileSync(envFile, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^DATABASE_URL="([^"]+)"$/);
    if (match) process.env.DATABASE_URL = match[1];
  });
} catch {
  // Ignore if file doesn't exist
}

const databaseUrl = process.env.DATABASE_URL;

console.log("DEBUG: DATABASE_URL =", databaseUrl);

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
} satisfies Config;

