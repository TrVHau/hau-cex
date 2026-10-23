import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';
import { resolve } from 'node:path';

// In production containers, DATABASE_URL is injected via environment.
// In local dev (cwd = apps/backend), load from root .env as fallback.
if (!process.env.DATABASE_URL) {
  config({ path: resolve(process.cwd(), '../../.env') });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },

  datasource: {
    url: env('DATABASE_URL'),
  },
});
