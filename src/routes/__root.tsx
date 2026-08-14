import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { NewsletterSignup } from "@/components/newsletter-signup";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-foreground">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or hasn't been published yet.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to today's edition
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Try refreshing or head back to the front page.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Front page
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "The Progressor — Progressive daily, explained by AI" },
      {
        name: "description",
        content:
          "A progressive daily, explained by AI. What happened, why it matters, and what to watch next in U.S. politics.",
      },
      { property: "og:title", content: "The Progressor — Progressive daily, explained by AI" },
      {
        property: "og:description",
        content:
          "Daily briefs, headlines, and deep-dive explainers on U.S. politics — explained by an AI editor with a progressive lens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "google-site-verification",
        content: "SHriMdMbteHutEnZUxscXyoSqKbiWzCDvRxut6aCsAw",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify([
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "The Progressor",
            url: "https://theprogressor.lovable.app",
            description: "Progressive daily, explained by AI.",
            potentialAction: {
              "@type": "SearchAction",
              target:
                "https://theprogressor.lovable.app/search?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "NewsMediaOrganization",
            name: "The Progressor",
            url: "https://theprogressor.lovable.app",
            logo: "https://theprogressor.lovable.app/favicon.png",
            email: "theprogressor@duck.com",
          },
        ]),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AccountNav() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading) return <span className="w-16" />;
  if (!user) {
    return (
      <Link
        to="/auth"
        className="rounded-md border border-primary-foreground/30 bg-primary-foreground px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-foreground/90"
      >
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link to="/dashboard" className="font-medium text-foreground hover:text-primary">
        Dashboard
      </Link>
      <button onClick={signOut} className="text-muted-foreground hover:text-foreground">
        Sign out
      </button>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-primary-foreground/15 bg-primary">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-4">
          <span className="flex items-baseline gap-1.5 leading-none">
            <span className="font-sans text-[10px] font-light uppercase tracking-[0.22em] text-black">
              The
            </span>
            <span
              className="font-serif text-3xl font-bold tracking-[-0.02em] text-white"
              style={{ fontVariationSettings: "'opsz' 72" }}
            >
              Progressor
            </span>
          </span>
          <span className="hidden h-7 w-px bg-primary-foreground/25 sm:block" />
          <span className="mt-0.5 hidden text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-primary-foreground/90 sm:inline">
            Progressive daily, explained by AI
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-primary-foreground/80 md:flex">
          <Link to="/" className="hover:text-primary-foreground [&.active]:text-primary-foreground">Today</Link>
          <Link to="/kind/$kind" params={{ kind: "news" }} className="hover:text-primary-foreground [&.active]:text-primary-foreground">News</Link>
          <Link to="/kind/$kind" params={{ kind: "analysis" }} className="hover:text-primary-foreground [&.active]:text-primary-foreground">Analysis</Link>
          <Link to="/kind/$kind" params={{ kind: "explainer" }} className="hover:text-primary-foreground [&.active]:text-primary-foreground">Explainers</Link>
          <Link to="/kind/$kind" params={{ kind: "opinion" }} className="hover:text-primary-foreground [&.active]:text-primary-foreground">Opinion</Link>
          <Link to="/topics" className="hover:text-primary-foreground [&.active]:text-primary-foreground">Topics</Link>
          <Link to="/crowdsource" className="hover:text-primary-foreground [&.active]:text-primary-foreground">Crowdsource</Link>
          <Link to="/about" className="hover:text-primary-foreground [&.active]:text-primary-foreground">About</Link>
          <Link to="/pricing" className="hover:text-primary-foreground [&.active]:text-primary-foreground">Pro</Link>

        </nav>
        <div className="ml-5 flex items-center gap-3">
          <Link
            to="/search"
            search={{ q: "" }}
            aria-label="Search"
            className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
          >
            Search
          </Link>
          <AccountNav />
        </div>
      </div>
      <div className="border-t border-primary-foreground/15 bg-primary/90">
        <div className="mx-auto flex max-w-6xl items-center gap-3 overflow-x-auto px-4 py-2 text-xs text-primary-foreground/80 md:hidden">
          <Link to="/" className="whitespace-nowrap hover:text-primary-foreground [&.active]:text-primary-foreground">Today</Link>
          <span className="text-primary-foreground/50">·</span>
          <Link to="/kind/$kind" params={{ kind: "news" }} className="whitespace-nowrap hover:text-primary-foreground [&.active]:text-primary-foreground">News</Link>
          <span className="text-primary-foreground/50">·</span>
          <Link to="/kind/$kind" params={{ kind: "analysis" }} className="whitespace-nowrap hover:text-primary-foreground [&.active]:text-primary-foreground">Analysis</Link>
          <span className="text-primary-foreground/50">·</span>
          <Link to="/kind/$kind" params={{ kind: "explainer" }} className="whitespace-nowrap hover:text-primary-foreground [&.active]:text-primary-foreground">Explainers</Link>
          <span className="text-primary-foreground/50">·</span>
          <Link to="/kind/$kind" params={{ kind: "opinion" }} className="whitespace-nowrap hover:text-primary-foreground [&.active]:text-primary-foreground">Opinion</Link>
          <span className="text-primary-foreground/50">·</span>
          <Link to="/topics" className="whitespace-nowrap hover:text-primary-foreground [&.active]:text-primary-foreground">Topics</Link>
          <span className="text-primary-foreground/50">·</span>
          <Link to="/crowdsource" className="whitespace-nowrap hover:text-primary-foreground [&.active]:text-primary-foreground">Crowdsource</Link>
          <span className="text-primary-foreground/50">·</span>
          <Link to="/about" className="whitespace-nowrap hover:text-primary-foreground [&.active]:text-primary-foreground">About</Link>
          <span aria-hidden>·</span>
          <Link to="/pricing" className="whitespace-nowrap hover:text-primary-foreground [&.active]:text-primary-foreground">Pro</Link>
          <span className="text-primary-foreground/50">·</span>

          <Link to="/search" search={{ q: "" }} className="whitespace-nowrap hover:text-primary-foreground [&.active]:text-primary-foreground">Search</Link>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-primary-foreground/15 bg-primary">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-primary-foreground/80">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="flex items-baseline gap-1 leading-none">
            <span className="font-sans text-[10px] font-light uppercase tracking-[0.22em] text-black">
              The
            </span>
            <span className="font-serif text-lg font-medium text-white">
              Progressor
            </span>
          </p>
          <p>
            An autonomous progressive news publication. Every article on this
            site is written by an AI editor.
          </p>
        </div>
        <div className="mt-6 border-t border-primary-foreground/15 pt-6">
          <NewsletterSignup />
        </div>

        <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <p className="max-w-2xl text-xs">
            We label content clearly: <span className="text-primary-foreground">News</span> is
            factual reporting, <span className="text-primary-foreground">Analysis</span> is
            interpretation, <span className="text-primary-foreground">Explainers</span> give
            evergreen background, and <span className="text-primary-foreground">Opinion</span> is
            explicitly editorial.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link to="/privacy" className="hover:text-primary-foreground hover:underline">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-primary-foreground hover:underline">
              Terms
            </Link>
            <a
              href="mailto:theprogressor@duck.com"
              className="hover:text-primary-foreground hover:underline"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function AuthSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
