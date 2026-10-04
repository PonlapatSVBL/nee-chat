-- Row Level Security as a second line of defence (server uses a direct connection that bypasses it).
alter table "loans" enable row level security;
alter table "payments" enable row level security;
alter table "payment_evidence" enable row level security;
alter table "payment_corrections" enable row level security;

create policy "loans_owner" on "loans" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payments_owner" on "payments" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payment_evidence_owner" on "payment_evidence" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "payment_corrections_owner" on "payment_corrections" for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private evidence bucket. Access only via signed URLs created server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence', 'evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
