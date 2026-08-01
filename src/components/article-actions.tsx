import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Link2, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  getMyReaction,
  getReaderState,
  setReaction,
  toggleSaveArticle,
} from "@/lib/reader.functions";

interface Props {
  articleId: string;
  slug: string;
  title: string;
  upvotes: number;
}

const btn =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground";

export function ArticleActions({ articleId, slug, title, upvotes }: Props) {
  const { user, loading } = useAuth();
  const [saved, setSaved] = useState(false);
  const [vote, setVote] = useState(0);
  const [count, setCount] = useState(upvotes);
  const [shareUrl, setShareUrl] = useState("");

  const fetchState = useServerFn(getReaderState);
  const fetchReaction = useServerFn(getMyReaction);
  const save = useServerFn(toggleSaveArticle);
  const react = useServerFn(setReaction);

  useEffect(() => {
    setShareUrl(`${window.location.origin}/article/${slug}`);
  }, [slug]);

  useEffect(() => {
    if (!user) {
      setSaved(false);
      setVote(0);
      return;
    }
    let active = true;
    void Promise.all([fetchState({}), fetchReaction({ data: { articleId } })])
      .then(([state, reaction]) => {
        if (!active) return;
        setSaved(state.savedIds.includes(articleId));
        setVote(reaction.value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [user, articleId, fetchState, fetchReaction]);

  async function onSave() {
    if (!user) return;
    const next = !saved;
    setSaved(next);
    try {
      await save({ data: { articleId, save: next } });
      toast.success(next ? "Saved for later" : "Removed from saved");
    } catch {
      setSaved(!next);
      toast.error("Couldn't update your saved list");
    }
  }

  async function onVote(value: 1 | -1) {
    if (!user) return;
    const next = vote === value ? 0 : value;
    setVote(next);
    try {
      const res = await react({ data: { articleId, value: next } });
      setCount(res.upvotes);
    } catch {
      setVote(vote);
      toast.error("Couldn't record your reaction");
    }
  }

  async function onShare() {
    const url = shareUrl || `/article/${slug}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => onVote(1)}
        className={`${btn} ${vote === 1 ? "border-primary text-foreground" : ""}`}
        aria-pressed={vote === 1}
        disabled={!user}
        title={user ? "Upvote" : "Sign in to react"}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        {count}
      </button>
      <button
        onClick={() => onVote(-1)}
        className={`${btn} ${vote === -1 ? "border-primary text-foreground" : ""}`}
        aria-pressed={vote === -1}
        aria-label="Thumbs down"
        disabled={!user}
        title={user ? "Thumbs down (private)" : "Sign in to react"}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>

      <button onClick={onSave} className={`${btn} ${saved ? "border-primary text-foreground" : ""}`} disabled={!user}>
        {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
        {saved ? "Saved" : "Save for later"}
      </button>

      <button onClick={onShare} className={btn}>
        <Share2 className="h-3.5 w-3.5" />
        Share
      </button>
      <a href={x} target="_blank" rel="noopener noreferrer" className={btn}>
        X
      </a>
      <a href={fb} target="_blank" rel="noopener noreferrer" className={btn}>
        Facebook
      </a>
      <a
        href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareUrl)}`}
        className={btn}
      >
        <Link2 className="h-3.5 w-3.5" />
        Email
      </a>

      {!loading && !user && (
        <Link to="/auth" className="text-xs text-primary underline">
          Sign in to save & react
        </Link>
      )}
    </div>
  );
}
