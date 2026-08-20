
CREATE TABLE public.podcast_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_slug text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT 'Listener',
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  ai_score integer NOT NULL DEFAULT 0,
  ai_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX podcast_comments_episode_idx ON public.podcast_comments (episode_slug, status, ai_score DESC, created_at DESC);

GRANT SELECT ON public.podcast_comments TO anon;
GRANT SELECT, INSERT ON public.podcast_comments TO authenticated;
GRANT ALL ON public.podcast_comments TO service_role;

ALTER TABLE public.podcast_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved comments"
  ON public.podcast_comments FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY "Users can read their own comments"
  ON public.podcast_comments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
