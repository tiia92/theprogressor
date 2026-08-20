import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { PRO_PRICES } from "@/lib/stripe";

const SITE = "https://theprogressor.lovable.app";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pro Membership Pricing | The Progressor" },
      {
        name: "description",
        content:
          "Go Pro for $5 a month: the daily briefing by email, personalized topic digests, ad-free reading and audio narration of every article.",
      },
      { property: "og:title", content: "Pro Membership Pricing — The Progressor" },
      {
        property: "og:description",
        content:
          "Daily and personalized email digests, ad-free reading and audio narration for $5 a month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/pricing` }],
  }),
  component: PricingPage,
});

const FREE = [
  "Full daily edition on the site",
  "Free weekly digest by email",
  "Unlimited saved articles",
  "Complete archive and search",
];

const PRO = [
  "The daily briefing in your inbox",
  "Personalized digests for the topics you follow",
  "Ad-free reading",
  "Audio narration of every article",
  "Everything in Free",
];

function PricingPage() {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [plan, setPlan] = useState<"monthly" | "yearly" | null>(null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PaymentTestModeBanner />

      <header className="mt-8 text-center">
        <h1 className="font-heading text-4xl tracking-tight">
          Support an AI newsroom that explains the news
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Reading The Progressor is free. Pro helps you make it a daily habit — plus
          it funds the newsroom.
        </p>
      </header>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-border p-6">
          <h2 className="font-heading text-2xl">Free</h2>
          <p className="mt-1 text-3xl font-bold">$0</p>
          <ul className="mt-5 space-y-2 text-sm">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link to="/">Keep reading</Link>
          </Button>
        </section>

        <section className="rounded-lg border-2 border-primary p-6">
          <h2 className="font-heading text-2xl">Pro</h2>
          <p className="mt-1 text-3xl font-bold">
            $5<span className="text-base font-normal text-muted-foreground">/month</span>
          </p>
          <p className="text-sm text-muted-foreground">or $50/year — two months free</p>
          <ul className="mt-5 space-y-2 text-sm">
            {PRO.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {isPro ? (
            <Button asChild className="mt-6 w-full">
              <Link to="/dashboard">Manage your membership</Link>
            </Button>
          ) : !user ? (
            <Button asChild className="mt-6 w-full">
              <Link to="/auth">Sign in to go Pro</Link>
            </Button>
          ) : (
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button onClick={() => setPlan("monthly")}>$5 / month</Button>
              <Button variant="outline" onClick={() => setPlan("yearly")}>
                $50 / year
              </Button>
            </div>
          )}
        </section>
      </div>

      {plan && (
        <div className="mt-10 rounded-lg border border-border p-4">
          <StripeEmbeddedCheckout
            priceId={PRO_PRICES[plan]}
            returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
          />
        </div>
      )}
    </div>
  );
}
