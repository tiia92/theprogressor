Add Privacy and Terms pages with footer navigation

Create two new routes and link them from the site footer:

1. `/privacy` (`src/routes/privacy.tsx`) — standard privacy policy for a news publication that uses AI generation, Google/email auth, reader interactions (votes, saves, follows), and NewsAPI/third-party services. Covers data collected, how it is used, cookies/analytics, account data, retention, user rights, and contact.

2. `/terms` (`src/routes/terms.tsx`) — standard terms of service covering use of the site, AI-generated content disclaimer, user conduct, intellectual property, disclaimers of warranty, limitation of liability, and contact.

3. Footer links (`src/routes/__root.tsx`) — add "Privacy" and "Terms" text links to `SiteFooter` alongside the existing footer content.

Each route gets its own `head()` metadata with unique title, description, og:title, and og:description. Content is owner-authored app copy, not a Lovable Trust Center lookalike.