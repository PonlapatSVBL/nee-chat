import { config } from 'dotenv';

config({ path: '.env.test' });

for (const key of ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key} in .env.test (copy from .env.example and fill from \`npx supabase status\`)`);
  }
}
