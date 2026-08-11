select cron.schedule(
  'progressor-daily-crowdsource',
  '45 11 * * *',
  $$
  select net.http_post(
    url := 'https://project--ad5d11ac-0909-4b32-a9d7-fb7ae30fb871-dev.lovable.app/api/public/hooks/generate-crowdsource',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYXRpdWFmcWNhYmdtZXF4aWluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MDQzMDUsImV4cCI6MjEwMDE4MDMwNX0.YqK1anfKlfxNELrv6cJcZcoEUwHAOO4vBPLjZV3OB6M"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);