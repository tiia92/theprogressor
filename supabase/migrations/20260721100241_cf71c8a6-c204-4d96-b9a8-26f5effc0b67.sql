
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  dek TEXT NOT NULL,
  body TEXT NOT NULL,
  article_type TEXT NOT NULL CHECK (article_type IN ('daily_brief','morning_headlines','evening_recap','deep_dive','explainer','timeline','weekly_roundup','news','analysis','opinion')),
  category TEXT NOT NULL DEFAULT 'politics',
  tags TEXT[] NOT NULL DEFAULT '{}',
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  hero_gradient TEXT NOT NULL DEFAULT 'sunrise',
  featured BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX articles_published_at_idx ON public.articles (published_at DESC);
CREATE INDEX articles_type_idx ON public.articles (article_type);
CREATE INDEX articles_category_idx ON public.articles (category);

GRANT SELECT ON public.articles TO anon;
GRANT SELECT ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Articles are publicly readable"
  ON public.articles FOR SELECT
  USING (true);
