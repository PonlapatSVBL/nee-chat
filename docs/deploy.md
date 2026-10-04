# Deploying หนี้ชัด

## 1. Supabase project

1. Create a project at https://supabase.com (region: Southeast Asia / Singapore).
2. Project Settings → API: copy `URL`, `anon` key, `service_role` key.
3. Project Settings → Database → Connection string: copy the **Session pooler** URI (port 5432) for migrations and the **Transaction pooler** URI (port 6543) for the app.
4. Run migrations from your machine:
   ```bash
   DATABASE_URL='<session pooler uri>' npx drizzle-kit migrate
   ```
   This also enables RLS (select-only owner policies; all writes go through the server) and creates the private `evidence` bucket.
5. Authentication → URL Configuration:
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: `https://<your-app>.vercel.app/auth/callback` (the template's `redirect_to` carries the deep link, so also allow `https://<your-app>.vercel.app/**` if Supabase rejects the redirect)
6. Authentication → Email Templates → Magic Link: paste the body of `supabase/templates/magic_link.html` and set the subject to `ลิงก์เข้าสู่ระบบ หนี้ชัด`. The template links to `/auth/callback?token_hash=…&type=email&redirect_to=…`.
7. Authentication → Providers → Email: keep "Confirm email" off (magic link only).
8. **Disable sign-ups after the owner's first login** (Authentication → Sign In / Providers → turn off "Allow new users to sign up"). The login flow uses `shouldCreateUser: true`, so until sign-ups are disabled anyone with an email address can create their own isolated account. If this app is meant to be single-user, do this right after you have logged in once.

## 2. Vercel

1. Import the repo. Framework: Next.js. Build command `npm run build`.
2. Environment variables (Production + Preview):
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server only) |
   | `DATABASE_URL` | transaction pooler URI (port 6543) |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` |
   No `TZ` variable is needed: "today" is always computed in Asia/Bangkok.
3. Deploy. Open the URL on your phone, log in with your email, add to home screen.

## 3. After each schema change

```bash
npm run db:generate -- --name <change>
DATABASE_URL='<session pooler uri>' npx drizzle-kit migrate
git add src/infrastructure/db/migrations && git commit
```

## 4. Rollback

Vercel → Deployments → promote the previous deployment. Database migrations are forward-only; write a new migration to undo a change.
