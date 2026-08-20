CREATE TABLE public.podcast_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  script text NOT NULL DEFAULT '',
  chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  audio_path text,
  duration_seconds integer,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  copy text NOT NULL DEFAULT '',
  link text,
  starts_on date,
  ends_on date,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.podcast_episodes TO anon, authenticated;
GRANT ALL ON public.podcast_episodes TO service_role;
GRANT SELECT ON public.sponsors TO anon, authenticated;
GRANT ALL ON public.sponsors TO service_role;

ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published episodes are public" ON public.podcast_episodes
  FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE POLICY "Active sponsors are public" ON public.sponsors
  FOR SELECT TO anon, authenticated USING (
    active
    AND (starts_on IS NULL OR starts_on <= CURRENT_DATE)
    AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
  );