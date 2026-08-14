// Server-only: Brevo calls through the Lovable connector gateway.
// Do NOT import this from client/route code — load it inside handlers.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";

export const SENDER = {
  name: "The Progressor",
  email: "discussabilityonline+prog@gmail.com",
};

function headers() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!brevoKey) throw new Error("BREVO_API_KEY is not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": brevoKey,
  };
}

async function brevoFetch(path: string, init: RequestInit) {
  const resp = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers: headers() });
  if (!resp.ok) {
    const body = await resp.text();
    console.error(`[brevo] ${path} failed [${resp.status}]: ${body}`);
    throw new Error(`Brevo request failed [${resp.status}]: ${body}`);
  }
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

/** Mirrors a subscriber into the Brevo contact list. Never fatal for signup. */
export async function upsertBrevoContact(email: string) {
  const listId = process.env.BREVO_LIST_ID;
  await brevoFetch("/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      updateEnabled: true,
      ...(listId ? { listIds: [Number(listId)] } : {}),
    }),
  });
}

/** Removes a contact from the Brevo list (used on unsubscribe). */
export async function removeBrevoContact(email: string) {
  await brevoFetch(`/contacts/${encodeURIComponent(email)}`, { method: "DELETE" });
}

export async function sendBrevoEmail(opts: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}) {
  await brevoFetch("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.htmlContent,
      ...(opts.textContent ? { textContent: opts.textContent } : {}),
    }),
  });
}
