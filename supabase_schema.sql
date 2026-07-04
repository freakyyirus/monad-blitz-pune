-- Create bounties table
create table bounties (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  prize text not null,
  creator_address text not null,
  status text check (status in ('OPEN', 'PAID')) default 'OPEN',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create submissions table
create table submissions (
  id uuid default gen_random_uuid() primary key,
  bounty_id uuid references bounties(id) on delete cascade not null,
  hunter_address text not null,
  content text not null,
  contact text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table bounties enable row level security;
alter table submissions enable row level security;

-- Create policies (for development, we'll allow public access, but in prod you'd want stricter rules)
create policy "Public bounties are viewable by everyone"
  on bounties for select
  using ( true );

create policy "Anyone can create bounties"
  on bounties for insert
  with check ( true );

create policy "Creators can update their bounties"
  on bounties for update
  using ( true ); -- Ideally check creator_address matches auth.uid() if using Supabase Auth, but we are using Privy/Wallet address

create policy "Public submissions are viewable by everyone"
  on submissions for select
  using ( true );

create policy "Anyone can submit"
  on submissions for insert
  with check ( true );

-- Storage Setup (Run this in Supabase SQL Editor)

-- 1. Create the 'media' bucket
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- 2. Create policies for the 'media' bucket
-- Note: We skip enabling RLS as it is enabled by default on storage.objects

drop policy if exists "Public Access to Media" on storage.objects;
create policy "Public Access to Media"
  on storage.objects for select
  using ( bucket_id = 'media' );

drop policy if exists "Anyone can upload Media" on storage.objects;
create policy "Anyone can upload Media"
  on storage.objects for insert
  with check ( bucket_id = 'media' );

