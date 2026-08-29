create table if not exists public.wallet_settings (
  dog_id uuid primary key references public.dogs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  show_rabies_status boolean not null default false,
  show_microchip_last4 boolean not null default false,
  show_service_animal boolean not null default false,
  show_emergency_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallet_settings_user_id_idx on public.wallet_settings(user_id);

alter table public.wallet_settings enable row level security;

create policy "wallet settings owner select"
on public.wallet_settings for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dogs d
    where d.id = dog_id and d.user_id = (select auth.uid())
  )
);

create policy "wallet settings owner insert"
on public.wallet_settings for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dogs d
    where d.id = dog_id and d.user_id = (select auth.uid())
  )
);

create policy "wallet settings owner update"
on public.wallet_settings for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dogs d
    where d.id = dog_id and d.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dogs d
    where d.id = dog_id and d.user_id = (select auth.uid())
  )
);

create policy "wallet settings owner delete"
on public.wallet_settings for delete
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dogs d
    where d.id = dog_id and d.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.wallet_settings to authenticated;
revoke all on public.wallet_settings from anon;

create table if not exists public.wallet_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  platform text not null check (platform in ('apple','google')),
  serial_number text not null default replace(gen_random_uuid()::text, '-', ''),
  provider_object_id text,
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dog_id, platform),
  unique (platform, serial_number)
);

create index if not exists wallet_passes_user_id_idx on public.wallet_passes(user_id);
create index if not exists wallet_passes_dog_id_idx on public.wallet_passes(dog_id);

alter table public.wallet_passes enable row level security;

create policy "wallet passes owner select"
on public.wallet_passes for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dogs d
    where d.id = dog_id and d.user_id = (select auth.uid())
  )
);

create policy "wallet passes owner insert"
on public.wallet_passes for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dogs d
    where d.id = dog_id and d.user_id = (select auth.uid())
  )
);

create policy "wallet passes owner update"
on public.wallet_passes for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dogs d
    where d.id = dog_id and d.user_id = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dogs d
    where d.id = dog_id and d.user_id = (select auth.uid())
  )
);

create policy "wallet passes owner delete"
on public.wallet_passes for delete
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.dogs d
    where d.id = dog_id and d.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.wallet_passes to authenticated;
revoke all on public.wallet_passes from anon;
