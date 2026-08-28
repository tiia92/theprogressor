CREATE TABLE public.insight_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  synthesis text NOT NULL DEFAULT '',
  confirmed jsonb NOT NULL DEFAULT '[]'::jsonb,
  disputed jsonb NOT NULL DEFAULT '[]'::jsonb,
  allegations jsonb NOT NULL DEFAULT '[]'::jsonb,
  unknowns jsonb NOT NULL DEFAULT '[]'::jsonb,
  prior_context jsonb NOT NULL DEFAULT '[]'::jsonb,
  stories jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  article_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.insight_reports TO anon;
GRANT SELECT ON public.insight_reports TO authenticated;
GRANT ALL ON public.insight_reports TO service_role;

ALTER TABLE public.insight_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published insight reports are public"
ON public.insight_reports FOR SELECT
TO anon, authenticated
USING (status = 'published');

CREATE INDEX insight_reports_week_idx ON public.insight_reports (week_start DESC);