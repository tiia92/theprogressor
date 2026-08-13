import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  crowdsourceChat,
  listCrowdsourceQueue,
  submitCrowdsourcePitch,
} from "@/lib/crowdsource.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/crowdsource")({
  head: () => ({
    meta: [
      { title: "Crowdsource — Pitch the next edition | The Progressor" },
      {
        name: "description",
        content:
          "Pitch a story or topic to The Progressor's Crowdsource desk. Our editor bot vets your sources, presses you on the merits, and the top five pitches run in the next daily Crowdsource edition.",
      },
      { property: "og:title", content: "Crowdsource — Pitch the next edition | The Progressor" },
      {
        property: "og:description",
        content:
          "Bring us a story. The Crowdsource desk vets the outlet, tests the claim, and publishes the five strongest reader pitches every day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CrowdsourcePage,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const OPENER: Msg = {
  role: "assistant",
  content:
    "Crowdsource desk. What should The Progressor cover next?\n\nDrop a link if you have one, or just tell me the topic — either way I'll want to know where it comes from and why it matters right now.",
};

interface Draft {
  title: string;
  summary: string;
  source_url: string | null;
  source_outlet: string | null;
  topics: string[];
  score: number;
  verdict: string;
}

function CrowdsourcePage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([OPENER]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filed, setFiled] = useState(false);
  const [isAdult, setIsAdult] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const queue = useQuery({ queryKey: ["crowdsource-queue"], queryFn: () => listCrowdsourceQueue() });

  const chat = useMutation({
    mutationFn: (next: Msg[]) => crowdsourceChat({ data: { messages: next } }),
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      if (res.ready && res.pitch) setDraft(res.pitch as Draft);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const file = useMutation({
    mutationFn: () =>
      submitCrowdsourcePitch({ data: { pitch: draft!, transcript: messages.slice(-40) } }),
    onSuccess: () => {
      setFiled(true);
      toast.success("Pitch filed to the desk.");
      queue.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chat.isPending]);

  function send() {
    const text = input.trim();
    if (!text || chat.isPending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    chat.mutate(next);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Crowdsource</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Pitch the next edition
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Bring us a story, a document, or a topic you think deserves attention. You'll be talking
          to the Crowdsource desk — The Progressor's editor bot. It's friendly, and it's picky.
        </p>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          {
            h: "It opens your link and reads it",
            p: "The desk fetches the page itself — headline, byline, date, text — so the outlet and the claim are checked against the real article, not your description of it.",
          },
          {
            h: "No link? Cite your sources",
            p: "Not sure where to start? Just say what happened and why it bothers you. The desk asks one plain question at a time — no expertise needed.",

          },

          {
            h: "Top five run tomorrow",
            p: "Every pitch gets a score. The five strongest are written up and published in the next daily Crowdsource edition.",
          },
        ].map((c) => (
          <div key={c.h} className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-serif text-lg font-semibold text-foreground">{c.h}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{c.p}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="flex h-[560px] flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Crowdsource desk · live
              </p>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                        : "max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted px-4 py-2.5 text-sm text-foreground"
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {chat.isPending && (
                <p className="text-sm italic text-muted-foreground">The desk is reading…</p>
              )}
            </div>

            {draft && (
              <div className="border-t border-border bg-muted/40 px-4 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                  Fit to file · score {draft.score}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold text-foreground">{draft.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{draft.summary}</p>
                {draft.source_outlet && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Source: {draft.source_outlet}
                    {draft.source_url ? ` — ${draft.source_url}` : ""}
                  </p>
                )}
                <div className="mt-3">
                  {filed ? (
                    <p className="text-sm font-medium text-foreground">
                      Filed. If it lands in today's top five, it runs in the next edition.
                    </p>
                  ) : user ? (
                    <>
                      <label className="flex items-start gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={isAdult}
                          onChange={(e) => setIsAdult(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                        />
                        <span>I confirm I'm 18 or older.</span>
                      </label>
                      <button
                        onClick={() => file.mutate()}
                        disabled={file.isPending || !isAdult}
                        className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        {file.isPending ? "Filing…" : "File this pitch"}
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/auth"
                      className="inline-flex rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
                    >
                      Sign in to file this pitch
                    </Link>
                  )}
                </div>

              </div>
            )}

            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={2}
                  placeholder="Paste a link, or describe the topic and why it matters…"
                  className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={send}
                  disabled={chat.isPending || !input.trim()}
                  className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside>
          <h2 className="font-serif text-xl font-semibold text-foreground">In line for tomorrow</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pitches that cleared the desk, ranked. The top five run in the next Crowdsource edition.
          </p>
          <ol className="mt-4 space-y-3">
            {(queue.data ?? []).map((p, i) => (
              <li key={p.id} className="border-b border-border pb-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <p className="font-medium text-foreground">{p.title}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.source_outlet ?? "Reader topic"} · score {p.score}
                </p>
              </li>
            ))}
            {queue.isSuccess && (queue.data ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">
                Nothing in line yet — yours could lead tomorrow's edition.
              </li>
            )}
          </ol>
        </aside>
      </div>
    </div>
  );
}
