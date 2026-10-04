-- Narrow RLS to read-only owner access. All writes go through the server (direct connection / service role).
drop policy if exists "loans_owner" on "loans";--> statement-breakpoint
drop policy if exists "payments_owner" on "payments";--> statement-breakpoint
drop policy if exists "payment_evidence_owner" on "payment_evidence";--> statement-breakpoint
drop policy if exists "payment_corrections_owner" on "payment_corrections";--> statement-breakpoint
create policy "loans_owner_select" on "loans" for select using (auth.uid() = user_id);--> statement-breakpoint
create policy "payments_owner_select" on "payments" for select using (auth.uid() = user_id);--> statement-breakpoint
create policy "payment_evidence_owner_select" on "payment_evidence" for select using (auth.uid() = user_id);--> statement-breakpoint
create policy "payment_corrections_owner_select" on "payment_corrections" for select using (auth.uid() = user_id);
