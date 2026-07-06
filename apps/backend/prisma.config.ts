import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(currentDirectory, '../../.env') });

export default defineConfig({
  schema: path.resolve(currentDirectory, './schema.prisma'),

  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx ./prisma/seed.ts',
  },

  generator: {
    url: env('DATABASE_URL'),
  },
});
