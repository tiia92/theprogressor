import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { submitPodcastComment } from "@/lib/podcast-comments.functions";

interface CommentRow {
  id: string;
  author_name: string;
  body: string;
  ai_score: number;
  created_at: string;
}

const TOP_COUNT = 4;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PodcastComments({ slug }: { slug: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const post = useServerFn(submitPodcastComment);
  const [body, setBody] = useState("");
  const [showAll, setShowAll] = useState(false);

  const comments = useQuery({
    queryKey: ["podcast-comments", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("podcast_comments")
        .select("id, author_name, body, ai_score, created_at")
        .eq("episode_slug", slug)
        .eq("status", "approved")
        .order("ai_score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as CommentRow[];
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const res = await post({ data: { slug, body } });
      if (res && "error" in res && res.error) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      setBody("");
      toast.success("Thanks — your feedback is posted.");
      void qc.invalidateQueries({ queryKey: ["podcast-comments", slug] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't post that comment."),
  });

  const all = comments.data ?? [];
  const visible = showAll ? all : all.slice(0, TOP_COUNT);

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="font-heading text-2xl text-foreground">Listener feedback</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Comments are screened automatically for abuse; the most substantive ones show first.
      </p>

      {user ? (
        <div className="mt-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="What landed, what missed, what should the show cover next week?"
            className="w-full rounded-md border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => send.mutate()}
              disabled={send.isPending || body.trim().length < 2}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {send.isPending ? "Screening…" : "Post feedback"}
            </button>
            <span className="text-xs text-muted-foreground">{body.length}/2000</span>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary underline">
            Sign in
          </Link>{" "}
          to leave feedback on this episode.
        </p>
      )}

      {comments.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading comments…</p>
      ) : all.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No feedback on this episode yet.</p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-border border-t border-border">
            {visible.map((c) => (
              <li key={c.id} className="py-4">
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {c.author_name} · {formatDate(c.created_at)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[0.975rem] leading-relaxed text-foreground/90">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>
          {all.length > TOP_COUNT && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-4 text-sm text-primary hover:underline"
            >
              {showAll ? "Show top comments only" : `Show all ${all.length} comments`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
