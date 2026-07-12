import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_dummy@ep-dummy-pooler.us-east-1.aws.neon.tech/neondb",
  },
  migrations: {
    seed: "node prisma/seed.js",
  },
});
