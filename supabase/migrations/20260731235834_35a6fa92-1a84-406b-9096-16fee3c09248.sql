-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- followed topics
CREATE TABLE public.followed_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_slug)
);
GRANT SELECT, INSERT, DELETE ON public.followed_topics TO authenticated;
GRANT ALL ON public.followed_topics TO service_role;
ALTER TABLE public.followed_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own followed topics" ON public.followed_topics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- followed keywords
CREATE TABLE public.followed_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, keyword)
);
GRANT SELECT, INSERT, DELETE ON public.followed_keywords TO authenticated;
GRANT ALL ON public.followed_keywords TO service_role;
ALTER TABLE public.followed_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own followed keywords" ON public.followed_keywords FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- saved articles
CREATE TABLE public.saved_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_articles TO authenticated;
GRANT ALL ON public.saved_articles TO service_role;
ALTER TABLE public.saved_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved articles" ON public.saved_articles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- reactions
ALTER TABLE public.articles ADD COLUMN upvotes integer NOT NULL DEFAULT 0;
ALTER TABLE public.articles ADD COLUMN downvotes integer NOT NULL DEFAULT 0;

CREATE TABLE public.article_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  value smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, article_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_reactions TO authenticated;
GRANT ALL ON public.article_reactions TO service_role;
ALTER TABLE public.article_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own reactions" ON public.article_reactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_reaction()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.value NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'reaction value must be -1 or 1';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER validate_article_reaction BEFORE INSERT OR UPDATE ON public.article_reactions
FOR EACH ROW EXECUTE FUNCTION public.validate_reaction();

CREATE OR REPLACE FUNCTION public.sync_reaction_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid;
BEGIN
  target := COALESCE(NEW.article_id, OLD.article_id);
  UPDATE public.articles a SET
    upvotes = (SELECT count(*) FROM public.article_reactions r WHERE r.article_id = target AND r.value = 1),
    downvotes = (SELECT count(*) FROM public.article_reactions r WHERE r.article_id = target AND r.value = -1)
  WHERE a.id = target;
  RETURN NULL;
END; $$;
CREATE TRIGGER article_reaction_counts AFTER INSERT OR UPDATE OR DELETE ON public.article_reactions
FOR EACH ROW EXECUTE FUNCTION public.sync_reaction_counts();

-- full-text search
ALTER TABLE public.articles ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(dek, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) STORED;
CREATE INDEX articles_search_idx ON public.articles USING gin (search_vector);
CREATE INDEX articles_tags_idx ON public.articles USING gin (tags);