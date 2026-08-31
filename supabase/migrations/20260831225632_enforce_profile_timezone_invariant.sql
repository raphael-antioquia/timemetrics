-- Enforce the profile timezone contract at the database boundary.
--
-- PostgreSQL and Intl.DateTimeFormat do not recognize exactly the same
-- timezone identifiers, so the application retains a defensive read-side
-- validator and UTC fallback.

create function public.is_allowed_profile_timezone(candidate text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if candidate is null then
    return false;
  end if;

  -- Mirror the TimeMetrics policy for fixed-offset and Etc/* forms.
  if
    candidate ~* '^(utc|gmt)?[+-]'
    or candidate ~* '^etc/'
  then
    return false;
  end if;

  -- Exercise the same PostgreSQL timezone-resolution mechanism used by
  -- analytics rather than relying on exact pg_timezone_names matching.
  begin
    perform pg_catalog.now() at time zone candidate;
    return true;
  exception
    when invalid_parameter_value then
      return false;
  end;
end;
$$;

-- New functions receive EXECUTE from PUBLIC by default. Remove that broad
-- access and explicitly retain it only for roles that may write timezone.
revoke all
on function public.is_allowed_profile_timezone(text)
from public, anon;

grant execute
on function public.is_allowed_profile_timezone(text)
to authenticated, service_role;

-- Repair existing invalid rows before installing the write barrier.
-- The backfill and trigger share the same validator.
update public.profiles
set timezone = 'UTC'
where not public.is_allowed_profile_timezone(timezone);

create function public.enforce_profile_timezone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_allowed_profile_timezone(new.timezone) then
    raise exception using
      errcode = '22023',
      message = 'invalid profile timezone',
      detail = pg_catalog.format(
        'rejected value: %L',
        new.timezone
      );
  end if;

  return new;
end;
$$;

-- Clients and service-role code do not invoke the trigger function directly.
revoke all
on function public.enforce_profile_timezone()
from public, anon, authenticated, service_role;

create trigger profiles_enforce_timezone
before insert or update of timezone
on public.profiles
for each row
execute function public.enforce_profile_timezone();
