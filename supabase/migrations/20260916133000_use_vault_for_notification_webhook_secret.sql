-- Move Supabase notification webhook trigger functions away from hardcoded
-- webhook-secret literals.
--
-- IMPORTANT: create the Vault secret named `signup_webhook_secret` outside this
-- migration before applying it. Do not commit the secret value to Git.
-- Production was updated on 2026-09-16 by copying the then-current live value
-- into Supabase Vault and verifying that these functions read from Vault.

create or replace function public.notify_new_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault', 'pg_temp'
as $function$
declare
  webhook_secret text;
begin
  select decrypted_secret
    into webhook_secret
  from vault.decrypted_secrets
  where name = 'signup_webhook_secret'
  limit 1;

  if webhook_secret is null then
    raise log 'notify_new_signup skipped: missing signup_webhook_secret in Supabase Vault';
    return new;
  end if;

  perform net.http_post(
    url     := 'https://www.yourpetpass.com/api/notify-signup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body    := jsonb_build_object('record', row_to_json(new))
  );
  return new;
exception when others then
  raise log 'notify_new_signup error for %: %', new.id, sqlerrm;
  return new;
end;
$function$;

create or replace function public.notify_new_error()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault', 'pg_temp'
as $function$
declare
  webhook_secret text;
begin
  select decrypted_secret
    into webhook_secret
  from vault.decrypted_secrets
  where name = 'signup_webhook_secret'
  limit 1;

  if webhook_secret is null then
    raise log 'notify_new_error skipped: missing signup_webhook_secret in Supabase Vault';
    return new;
  end if;

  perform net.http_post(
    url     := 'https://www.yourpetpass.com/api/notify-error',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body    := jsonb_build_object('record', row_to_json(new))
  );
  return new;
exception when others then
  raise log 'notify_new_error error for %: %', new.id, sqlerrm;
  return new;
end;
$function$;
