create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop trigger if exists set_categories_updated_at on public.categories;

create trigger set_categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();


drop trigger if exists set_activities_updated_at on public.activities;

create trigger set_activities_updated_at
before update on public.activities
for each row
execute function public.set_updated_at();


drop trigger if exists set_time_blocks_updated_at on public.time_blocks;

create trigger set_time_blocks_updated_at
before update on public.time_blocks
for each row
execute function public.set_updated_at();