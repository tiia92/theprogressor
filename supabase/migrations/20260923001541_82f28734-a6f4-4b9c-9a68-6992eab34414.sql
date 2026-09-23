select cron.unschedule(10);
select cron.unschedule(12);
select cron.schedule(
  'generate-podcast',
  '30 10 * * 0',
  $$
  select net.http_post(
    url := 'https://project--ad5d11ac-0909-4b32-a9d7-fb7ae30fb871-dev.lovable.app/api/public/hooks/generate-podcast',
    headers := jsonb_build_object('Content-Type','application/json','apikey', current_setting('app.settings.publishable_key', true)),
    body := '{}'::jsonb,
    timeout_milliseconds := 900000
  );
  $$
);