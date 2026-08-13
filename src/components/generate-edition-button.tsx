import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { triggerEditionGeneration } from "@/lib/articles.functions";
import { useAuth } from "@/hooks/use-auth";

const ADMIN_EMAIL = "discussabilityonline@gmail.com";

export function GenerateEditionButton({ variant = "hero" }: { variant?: "hero" | "compact" }) {
  const { user, loading } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const fn = useServerFn(triggerEditionGeneration);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => fn({ data: undefined as never }),
    onSuccess: (r) => {
      toast.success(`Published ${r.inserted} new articles`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message ?? "Generation failed"),
  });

  const label = m.isPending ? "Writing today's edition…" : "Generate today's edition";

  if (variant === "compact") {
    return (
      <button
        onClick={() => m.mutate()}
        disabled={m.isPending}
        className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
      >
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={() => m.mutate()}
      disabled={m.isPending}
      className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
