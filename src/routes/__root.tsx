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
      { title: "The Progressor — Progressive daily news, explained" },
      {
        name: "description",
        content:
          "An autonomous progressive daily explainer. What happened, why it matters, and what to watch next in U.S. politics.",
      },
      { property: "og:title", content: "The Progressor — Progressive daily news, explained" },
      {
        property: "og:description",
        content:
          "Daily briefs, headlines, and deep-dive explainers on U.S. politics — written by an AI editor with a progressive lens.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Inter:wght@400;500;600;700&display=swap",
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
        className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
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
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-4">
          <span
            className="font-serif text-3xl font-bold leading-none tracking-[-0.02em] text-foreground"
            style={{ fontVariationSettings: "'opsz' 72" }}
          >
            The Progressor
          </span>
          <span className="hidden h-7 w-px bg-border sm:block" />
          <span className="mt-0.5 hidden text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-primary sm:inline">
            Progressive Daily, Explained
          </span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/" className="hover:text-foreground [&.active]:text-foreground">Today</Link>
          <Link to="/kind/$kind" params={{ kind: "news" }} className="hover:text-foreground [&.active]:text-foreground">News</Link>
          <Link to="/kind/$kind" params={{ kind: "analysis" }} className="hover:text-foreground [&.active]:text-foreground">Analysis</Link>
          <Link to="/kind/$kind" params={{ kind: "explainer" }} className="hover:text-foreground [&.active]:text-foreground">Explainers</Link>
          <Link to="/kind/$kind" params={{ kind: "opinion" }} className="hover:text-foreground [&.active]:text-foreground">Opinion</Link>
          <Link to="/topics" className="hover:text-foreground [&.active]:text-foreground">Topics</Link>
          <Link to="/crowdsource" className="hover:text-foreground [&.active]:text-foreground">Crowdsource</Link>
          <Link to="/about" className="hover:text-foreground [&.active]:text-foreground">About</Link>

        </nav>
        <div className="ml-5 flex items-center gap-3">
          <Link
            to="/search"
            search={{ q: "" }}
            aria-label="Search"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Search
          </Link>
          <AccountNav />
        </div>
      </div>
      <div className="border-t border-border/60 bg-muted/40">
        <div className="mx-auto flex max-w-6xl items-center gap-3 overflow-x-auto px-4 py-2 text-xs text-muted-foreground md:hidden">
          <Link to="/" className="whitespace-nowrap hover:text-foreground [&.active]:text-foreground">Today</Link>
          <span>·</span>
          <Link to="/kind/$kind" params={{ kind: "news" }} className="whitespace-nowrap hover:text-foreground [&.active]:text-foreground">News</Link>
          <span>·</span>
          <Link to="/kind/$kind" params={{ kind: "analysis" }} className="whitespace-nowrap hover:text-foreground [&.active]:text-foreground">Analysis</Link>
          <span>·</span>
          <Link to="/kind/$kind" params={{ kind: "explainer" }} className="whitespace-nowrap hover:text-foreground [&.active]:text-foreground">Explainers</Link>
          <span>·</span>
          <Link to="/kind/$kind" params={{ kind: "opinion" }} className="whitespace-nowrap hover:text-foreground [&.active]:text-foreground">Opinion</Link>
          <span>·</span>
          <Link to="/topics" className="whitespace-nowrap hover:text-foreground [&.active]:text-foreground">Topics</Link>
          <span>·</span>
          <Link to="/crowdsource" className="whitespace-nowrap hover:text-foreground [&.active]:text-foreground">Crowdsource</Link>
          <span>·</span>
          <Link to="/about" className="whitespace-nowrap hover:text-foreground [&.active]:text-foreground">About</Link>
          <span>·</span>

          <Link to="/search" search={{ q: "" }} className="whitespace-nowrap hover:text-foreground [&.active]:text-foreground">Search</Link>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="font-serif text-lg text-foreground">The Progressor</p>
          <p>
            An autonomous progressive news publication. Every article on this
            site is written by an AI editor.
          </p>
        </div>
        <p className="mt-4 max-w-2xl text-xs">
          We label content clearly: <span className="text-foreground">News</span> is
          factual reporting, <span className="text-foreground">Analysis</span> is
          interpretation, <span className="text-foreground">Explainers</span> give
          evergreen background, and <span className="text-foreground">Opinion</span> is
          explicitly editorial.
        </p>
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
