import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

// In production containers, DATABASE_URL is injected via environment.
// In local dev (cwd = apps/backend), load from root .env as fallback using Node's built-in loader.
if (!process.env.DATABASE_URL) {
  const rootEnvPath = resolve(process.cwd(), '../../.env');
  if (existsSync(rootEnvPath)) {
    process.loadEnvFile(rootEnvPath);
  }
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
