CREATE TABLE public.news_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  outlet text NOT NULL DEFAULT '',
  published_at timestamp with time zone NOT NULL,
  topics text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'gdelt',
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,''))
  ) STORED,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX news_archive_search_idx ON public.news_archive USING gin (search_vector);
CREATE INDEX news_archive_published_idx ON public.news_archive (published_at DESC);
CREATE INDEX news_archive_topics_idx ON public.news_archive USING gin (topics);

GRANT ALL ON public.news_archive TO service_role;
ALTER TABLE public.news_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_archive service only" ON public.news_archive FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.archive_backfill_windows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  window_key text NOT NULL UNIQUE,
  month_start date NOT NULL,
  topic text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rows_stored integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX archive_backfill_windows_status_idx ON public.archive_backfill_windows (status, month_start);

GRANT ALL ON public.archive_backfill_windows TO service_role;
ALTER TABLE public.archive_backfill_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "archive_backfill_windows service only" ON public.archive_backfill_windows FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.job_leases (
  job_name text NOT NULL PRIMARY KEY,
  locked_until timestamp with time zone NOT NULL DEFAULT now(),
  paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.job_leases TO service_role;
ALTER TABLE public.job_leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_leases service only" ON public.job_leases FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER archive_backfill_windows_touch BEFORE UPDATE ON public.archive_backfill_windows
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER job_leases_touch BEFORE UPDATE ON public.job_leases
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();