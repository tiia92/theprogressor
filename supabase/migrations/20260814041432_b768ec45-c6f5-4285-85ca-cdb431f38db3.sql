CREATE TABLE public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'subscribed',
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  brevo_synced BOOLEAN NOT NULL DEFAULT false,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.newsletter_subscribers TO service_role;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE INDEX newsletter_subscribers_status_idx ON public.newsletter_subscribers (status);