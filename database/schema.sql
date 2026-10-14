-- LostFound production schema for Supabase/PostgreSQL. Run once in the SQL editor.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 campus_id text unique,
 display_name text not null default 'Campus user',
 role text not null default 'student' check(role in ('student','admin')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.items (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 item_name text not null check(char_length(item_name) between 1 and 60),
 description text not null check(char_length(description) between 1 and 1000),
 category text not null,
 report_type text not null check(report_type in ('Lost','Found')),
 location text not null check(char_length(location) between 1 and 120),
 occurred_at date,
 status text not null default 'Searching' check(status in ('Searching','Contacted','Submitted','Returned')),
 urgent boolean not null default false,
 image_path text,
 archived_at timestamptz,
 expires_at timestamptz not null default (now() + interval '90 days'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.claims (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.items(id) on delete cascade,
 claimant_id uuid not null references auth.users(id) on delete cascade,
 private_proof text not null check(char_length(private_proof) between 1 and 300),
 status text not null default 'Pending' check(status in ('Pending','Approved','Rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 unique(item_id,claimant_id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.items(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 300),
 created_at timestamptz not null default now()
);
create table public.messages (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.items(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 500),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 check(sender_id <> recipient_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id uuid references public.items(id) on delete set null,
 kind text not null,
 title text not null check(char_length(title) <= 120),
 body text not null check(char_length(body) <= 500),
 read_at timestamptz,
 email_sent_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.reports (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.items(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(char_length(reason) between 1 and 240),
 resolved_at timestamptz,
 resolved_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(item_id,reporter_id)
);
create index items_board_idx on public.items(archived_at,created_at desc) where archived_at is null;
create index items_search_idx on public.items using gin(to_tsvector('english',item_name || ' ' || description));
create index items_location_idx on public.items(location);
create index claims_item_status_idx on public.claims(item_id,status);
create index messages_participants_idx on public.messages(sender_id,recipient_id,created_at desc);
create index notifications_user_idx on public.notifications(user_id,created_at desc);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger items_set_updated_at before update on public.items for each row execute function public.set_updated_at();

-- Campus ID is deliberately not copied from signup metadata; verify it through the institution first.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,display_name,role)
 values(new.id,coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'Campus user'),'student')
 on conflict(id) do nothing;
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.claims enable row level security;
alter table public.comments enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
create policy "Own profile or admin" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
-- No client-side profile update policy: roles and verified campus IDs are managed by trusted staff.
create policy "Read active items or own history" on public.items for select to anon,authenticated using(archived_at is null or owner_id=auth.uid() or public.is_admin());
create policy "Create own items" on public.items for insert to authenticated with check(owner_id=auth.uid());
create policy "Owners or admins update items" on public.items for update to authenticated using(owner_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or public.is_admin());
create policy "Owners or admins delete items" on public.items for delete to authenticated using(owner_id=auth.uid() or public.is_admin());
create policy "Claimant owner or admin reads claims" on public.claims for select to authenticated using(claimant_id=auth.uid() or exists(select 1 from public.items i where i.id=item_id and i.owner_id=auth.uid()) or public.is_admin());
create policy "Claim found item" on public.claims for insert to authenticated with check(claimant_id=auth.uid() and exists(select 1 from public.items i where i.id=item_id and i.report_type='Found' and i.owner_id<>auth.uid() and i.archived_at is null));
create policy "Item owner or admin reviews claim" on public.claims for update to authenticated using(exists(select 1 from public.items i where i.id=item_id and i.owner_id=auth.uid()) or public.is_admin()) with check(exists(select 1 from public.items i where i.id=item_id and i.owner_id=auth.uid()) or public.is_admin());
revoke update on public.claims from anon,authenticated;
grant update(status,reviewed_at) on public.claims to authenticated;
create policy "Read comments on active items" on public.comments for select to anon,authenticated using(exists(select 1 from public.items i where i.id=item_id and (i.archived_at is null or i.owner_id=auth.uid() or public.is_admin())));
create policy "Signed-in comments" on public.comments for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from public.items i where i.id=item_id and i.archived_at is null));
create policy "Author or admin deletes comment" on public.comments for delete to authenticated using(author_id=auth.uid() or public.is_admin());
create policy "Message participants only" on public.messages for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid() or public.is_admin());
create policy "Send item messages to owner or claimant" on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(
 select 1 from public.items i where i.id=item_id and i.archived_at is null and (
   (i.owner_id=sender_id and exists(select 1 from public.claims c where c.item_id=i.id and c.claimant_id=recipient_id))
   or (i.owner_id=recipient_id and i.owner_id<>sender_id)
 )));
create policy "Recipient marks messages read" on public.messages for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
revoke update on public.messages from anon,authenticated;
grant update(read_at) on public.messages to authenticated;
create policy "Read own notifications" on public.notifications for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "Mark own notifications read" on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke update on public.notifications from anon,authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy "Submit reports on others items" on public.reports for insert to authenticated with check(reporter_id=auth.uid() and exists(select 1 from public.items i where i.id=item_id and i.owner_id<>auth.uid()));
create policy "Admins review reports" on public.reports for select to authenticated using(public.is_admin());
create policy "Admins resolve reports" on public.reports for update to authenticated using(public.is_admin()) with check(public.is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('item-images','item-images',true,2097152,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Read item images" on storage.objects for select using(bucket_id='item-images');
create policy "Upload to own folder" on storage.objects for insert to authenticated with check(bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Update own images" on storage.objects for update to authenticated using(bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Delete own images" on storage.objects for delete to authenticated using(bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.archive_stale_items() returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
 update public.items set archived_at=now(),updated_at=now() where archived_at is null and status<>'Returned' and expires_at<=now();
 get diagnostics affected=row_count;
 return affected;
end; $$;
revoke all on function public.archive_stale_items() from public,anon,authenticated;
