/** Strip markdown so the narrator doesn't read syntax aloud. */
export function plainTextForNarration(
  title: string,
  dek: string | null | undefined,
  body: string | null | undefined,
): string {
  const raw = [title, dek ?? "", body ?? ""].filter(Boolean).join(".\n\n");
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split into narration-sized pieces at sentence boundaries. */
export function chunkForNarration(text: string, maxWords = 320): string[] {
  const count = (s: string) => (s.match(/\S+/g) ?? []).length;
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const sentence of sentences) {
    if (count(sentence) > maxWords) {
      flush();
      const words = sentence.match(/\S+/g) ?? [];
      for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(" "));
      }
      continue;
    }
    if (current && count(current) + count(sentence) > maxWords) flush();
    current += sentence;
  }
  flush();
  return chunks.length ? chunks : [text];
}
