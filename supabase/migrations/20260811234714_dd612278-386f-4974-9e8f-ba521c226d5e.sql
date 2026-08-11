CREATE TABLE public.crowdsource_pitches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_url TEXT,
  source_outlet TEXT,
  topics TEXT[] NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL DEFAULT 0,
  verdict TEXT,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.crowdsource_pitches TO authenticated;
GRANT SELECT ON public.crowdsource_pitches TO anon;
GRANT ALL ON public.crowdsource_pitches TO service_role;

ALTER TABLE public.crowdsource_pitches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accepted pitches are public"
  ON public.crowdsource_pitches FOR SELECT TO anon, authenticated
  USING (status = 'accepted');

CREATE POLICY "Readers can see their own pitches"
  ON public.crowdsource_pitches FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Readers can submit their own pitches"
  ON public.crowdsource_pitches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX crowdsource_pitches_rank_idx
  ON public.crowdsource_pitches (created_at DESC, score DESC);