import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Membership Confirmed | The Progressor" },
      {
        name: "description",
        content:
          "Your Progressor Pro membership is being confirmed. Daily briefings and personalized digests start with the next edition.",
      },
      { property: "og:title", content: "Membership Confirmed — The Progressor" },
      {
        property: "og:description",
        content: "Thanks for supporting The Progressor. Your Pro membership is active.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id: sessionId } = Route.useSearch();

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="font-heading text-3xl">
        {sessionId ? "You're a Pro member" : "No checkout session found"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {sessionId
          ? "Thanks for backing the newsroom. Your daily briefing and personalized digests begin with the next edition."
          : "We couldn't find a checkout to confirm. If you just paid, check your email for a receipt."}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild>
          <Link to="/dashboard">Go to your dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Read today's edition</Link>
        </Button>
      </div>
    </div>
  );
}
