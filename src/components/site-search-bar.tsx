import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SiteSearchBarProps {
  className?: string;
}

export function SiteSearchBar({ className = "mt-6" }: SiteSearchBarProps) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  return (
    <form
      role="search"
      className={`flex w-full max-w-xl gap-2 ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        void navigate({ to: "/search", search: { q: term.trim() } });
      }}
    >
      <Input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search headlines, topics, and full text…"
        aria-label="Search The Progressor"
      />
      <Button type="submit" className="shrink-0">
        Search
      </Button>
    </form>
  );
}
