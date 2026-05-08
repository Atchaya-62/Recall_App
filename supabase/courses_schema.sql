-- Generated Courses and Progress Tracking schema
-- Run this in Supabase SQL Editor.

-- Ensure UUID support.
create extension if not exists "uuid-ossp";

-- Store generated course plans per user.
create table if not exists public.generated_courses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Store per-course progress and quiz history per user.
create table if not exists public.course_tracking (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references public.generated_courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_module_ids text[] not null default '{}',
  quiz_scores integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_tracking_course_user_unique unique (course_id, user_id)
);

create index if not exists idx_generated_courses_user_id on public.generated_courses(user_id);
create index if not exists idx_course_tracking_user_id on public.course_tracking(user_id);
create index if not exists idx_course_tracking_course_id on public.course_tracking(course_id);

-- Keep updated_at current.
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_generated_courses_updated_at on public.generated_courses;
create trigger update_generated_courses_updated_at
before update on public.generated_courses
for each row execute function public.update_updated_at_column();

drop trigger if exists update_course_tracking_updated_at on public.course_tracking;
create trigger update_course_tracking_updated_at
before update on public.course_tracking
for each row execute function public.update_updated_at_column();

-- Enable RLS.
alter table public.generated_courses enable row level security;
alter table public.course_tracking enable row level security;

-- generated_courses policies.
drop policy if exists "Users can view own generated courses" on public.generated_courses;
create policy "Users can view own generated courses" on public.generated_courses
for select using (auth.uid() = user_id);

drop policy if exists "Users can create own generated courses" on public.generated_courses;
create policy "Users can create own generated courses" on public.generated_courses
for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own generated courses" on public.generated_courses;
create policy "Users can update own generated courses" on public.generated_courses
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own generated courses" on public.generated_courses;
create policy "Users can delete own generated courses" on public.generated_courses
for delete using (auth.uid() = user_id);

-- course_tracking policies.
drop policy if exists "Users can view own course tracking" on public.course_tracking;
create policy "Users can view own course tracking" on public.course_tracking
for select using (auth.uid() = user_id);

drop policy if exists "Users can create own course tracking" on public.course_tracking;
create policy "Users can create own course tracking" on public.course_tracking
for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own course tracking" on public.course_tracking;
create policy "Users can update own course tracking" on public.course_tracking
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own course tracking" on public.course_tracking;
create policy "Users can delete own course tracking" on public.course_tracking
for delete using (auth.uid() = user_id);
