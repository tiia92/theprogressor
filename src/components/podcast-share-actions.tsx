import { useEffect, useState } from "react";
import { Link2, Share2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  slug: string;
  title: string;
}

const btn =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground";

export function PodcastShareActions({ slug, title }: Props) {
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    setShareUrl(`${window.location.origin}/podcast/${slug}`);
  }, [slug]);

  async function onShare() {
    const url = shareUrl || `/podcast/${slug}`;
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
  const mail = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <a href={mail} className={btn}>
        <Link2 className="h-3.5 w-3.5" />
        Email
      </a>
    </div>
  );
}
