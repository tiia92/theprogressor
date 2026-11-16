// Which single non-news piece publishes on a given day, cycling in order.
export const ROTATION = ["analysis", "explainer", "opinion"] as const;
export type RotationKind = (typeof ROTATION)[number];

export function rotationKindFor(dateISO: string): RotationKind {
  const days = Math.floor(Date.parse(`${dateISO}T00:00:00Z`) / 86_400_000);
  return ROTATION[((days % 3) + 3) % 3];
}
