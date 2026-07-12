-- =============================================================================
-- TimeMetrics: Core Database Schema
-- =============================================================================
-- Purpose: Defines the core tables for TimeMetrics — a personal time
--          tracking app where users log categories, activities, and
--          time blocks against their own profile.
--
-- Tables: profiles, categories, activities, time_blocks
-- Type:   public.plan (enum for subscription tier)
--
-- Hierarchy / relationships:
--   auth.users (Supabase managed)
--     └─ profiles        (1:1 with auth.users, extends it with app data)
--          └─ categories  (many per user)
--               └─ activities  (many per user, optionally tagged with a category)
--                    └─ time_blocks (many per user, optionally tagged with an activity)
--
-- RLS: See separate RLS policies file — this schema alone does NOT
--      restrict access. Row Level Security must be enabled and policies
--      applied before this schema is safe to expose to client roles.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
-- pgcrypto provides gen_random_uuid(), used as the default for all
-- primary keys below instead of the sequential/serial approach.

create extension if not exists pgcrypto;


-- -----------------------------------------------------------------------------
-- Enum: plan
-- -----------------------------------------------------------------------------
-- Represents the user's subscription tier. Kept as an enum (rather than
-- text) so invalid values are rejected at the database level, not just
-- in application code. New tiers require a migration to extend this enum.

create type public.plan as enum (
  'free',
  'pro'
);


-- -----------------------------------------------------------------------------
-- Table: profiles
-- -----------------------------------------------------------------------------
-- Extends auth.users with app-specific data. One row per user, created
-- either via a signup trigger or client-side insert (see RLS policies).
-- `id` is both the primary key and a foreign key to auth.users, enforcing
-- the 1:1 relationship and cascading deletes when a user is removed.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan_id public.plan not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- Table: categories
-- -----------------------------------------------------------------------------
-- User-defined groupings for activities (e.g. "Work", "Gym", "Reading").
-- Deleting a profile cascades and removes all of that user's categories.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  name text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Prevent blank/whitespace-only names (e.g. "   ")
  constraint categories_name_not_empty check (length(trim(name)) > 0),

  -- Prevent a user from creating two categories with the same name
  constraint categories_unique_user_name unique (user_id, name)
);


-- -----------------------------------------------------------------------------
-- Table: activities
-- -----------------------------------------------------------------------------
-- Trackable activities (e.g. "Deep Work", "Pickleball Practice"),
-- optionally tagged with a category. If the linked category is deleted,
-- category_id is set to null rather than deleting the activity itself —
-- the activity survives independently of its category.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,

  name text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint activities_name_not_empty check (length(trim(name)) > 0),
  constraint activities_unique_user_name unique (user_id, name)
);


-- -----------------------------------------------------------------------------
-- Table: time_blocks
-- -----------------------------------------------------------------------------
-- Individual logged sessions of time spent, optionally tied to an
-- activity. `ended_at` is nullable to support an "in progress" time
-- block (started but not yet stopped). If the linked activity is
-- deleted, activity_id is set to null rather than deleting the time
-- block — historical time data is preserved.

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,

  started_at timestamptz not null,
  ended_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Guard against nonsensical ranges (end before/equal to start).
  -- Null ended_at (in-progress block) is explicitly allowed.
  constraint time_blocks_valid_time_range
    check (ended_at is null or ended_at > started_at)
);

-- Speeds up the most common query pattern: "give me this user's time
-- blocks, most recent first" (e.g. dashboard/history views).
create index time_blocks_user_started_at_idx
on public.time_blocks (user_id, started_at desc);


-- =============================================================================
-- Teardown: Non-cascading drop
-- =============================================================================
-- Use this version when you want Postgres to ERROR if a table/type still
-- has dependent objects (e.g. views, other tables not listed here) rather
-- than silently dropping them too. Safer for catching unexpected
-- dependencies during development. Order matters here: children before
-- parents (time_blocks → activities → categories → profiles) since
-- foreign keys would otherwise block the drop.

drop table if exists public.time_blocks;
drop table if exists public.activities;
drop table if exists public.categories;
drop table if exists public.profiles;

drop type if exists public.plan;


-- =============================================================================
-- Teardown: Cascading drop
-- =============================================================================
-- Use this version to force-drop each table/type AND anything that
-- depends on it (policies, views, foreign keys from other tables, etc.)
-- without erroring. Convenient for a full local/dev reset, but DANGEROUS
-- on any environment with real data or objects you don't want silently
-- destroyed. Drop order is less critical here since CASCADE handles
-- dependency resolution, but children-first is kept for consistency
-- and readability.

drop table if exists public.time_blocks cascade;
drop table if exists public.activities cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;

drop type if exists public.plan cascade;