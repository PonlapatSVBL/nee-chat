import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/db/schema.ts',
  out: './src/infrastructure/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! },
  schemaFilter: ['public'],
  strict: true,
  verbose: true,
});
