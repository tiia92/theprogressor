// Server-only: subscriber storage + the daily edition alert email.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendBrevoEmail, upsertBrevoContact, removeBrevoContact } from "@/lib/brevo.server";

export const SITE_URL = "https://theprogressor.lovable.app";

export async function subscribeEmail(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("newsletter_subscribers")
    .upsert(
      { email, status: "subscribed" },
      { onConflict: "email" },
    )
    .select("email, unsubscribe_token")
    .single();
  if (error) throw new Error(error.message);

  // Mirror into Brevo — never fail the signup if the sync hiccups.
  try {
    await upsertBrevoContact(email);
    await supabaseAdmin
      .from("newsletter_subscribers")
      .update({ brevo_synced: true })
      .eq("email", email);
  } catch (e) {
    console.error("[newsletter] brevo sync failed", e);
  }

  return { ok: true as const, unsubscribeToken: data.unsubscribe_token };
}

export async function unsubscribeByToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed" })
    .eq("unsubscribe_token", token)
    .select("email")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ok: false as const };
  await removeBrevoContact(data.email).catch(() => null);
  return { ok: true as const, email: data.email };
}

interface EditionArticle {
  slug: string;
  title: string;
  dek: string;
  article_type: string;
}

function renderEdition(articles: EditionArticle[], token: string, date: string) {
  const items = articles
    .map(
      (a) => `
        <tr><td style="padding:0 0 20px 0;">
          <div style="font:600 11px/1.2 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#1d4ed8;">
            ${a.article_type.replace(/_/g, " ")}
          </div>
          <a href="${SITE_URL}/article/${a.slug}" style="font:700 19px/1.3 Georgia,serif;color:#0f172a;text-decoration:none;">
            ${a.title}
          </a>
          <div style="font:400 14px/1.5 Arial,sans-serif;color:#475569;padding-top:6px;">${a.dek}</div>
        </td></tr>`,
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#ffffff;">
    <table role="presentation" width="100%" style="background:#ffffff;"><tr><td align="center">
      <table role="presentation" width="600" style="max-width:600px;padding:28px 24px;">
        <tr><td style="padding-bottom:6px;">
          <span style="font:300 11px/1 Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#0f172a;">The</span>
          <span style="font:500 22px/1 Georgia,serif;color:#1d4ed8;">Progressor</span>
        </td></tr>
        <tr><td style="font:400 13px/1.4 Arial,sans-serif;color:#64748b;padding-bottom:22px;">
          Today's edition — ${date}
        </td></tr>
        ${items}
        <tr><td style="padding-top:8px;">
          <a href="${SITE_URL}" style="display:inline-block;background:#1d4ed8;color:#ffffff;font:600 14px/1 Arial,sans-serif;padding:12px 20px;border-radius:6px;text-decoration:none;">Read the full edition</a>
        </td></tr>
        <tr><td style="padding-top:26px;font:400 12px/1.5 Arial,sans-serif;color:#94a3b8;border-top:1px solid #e2e8f0;">
          Every article is written by an AI editor.
          <a href="${SITE_URL}/api/public/newsletter/unsubscribe?token=${token}" style="color:#94a3b8;">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

/** Emails every active subscriber a digest of the day's new edition. Never fatal. */
export async function sendEditionAlert(articles: EditionArticle[], date: string) {
  if (!articles.length) return { sent: 0 };

  const { data: subs, error } = await supabaseAdmin
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token")
    .eq("status", "subscribed");
  if (error) throw new Error(error.message);
  if (!subs?.length) return { sent: 0 };

  const lead = articles.find((a) => a.article_type === "daily_brief") ?? articles[0];
  const subject = `The Progressor — ${lead.title}`;

  let sent = 0;
  for (const sub of subs) {
    try {
      await sendBrevoEmail({
        to: sub.email,
        subject,
        htmlContent: renderEdition(articles, sub.unsubscribe_token, date),
        textContent: articles
          .map((a) => `${a.title}\n${a.dek}\n${SITE_URL}/article/${a.slug}`)
          .join("\n\n"),
      });
      sent++;
    } catch (e) {
      console.error("[newsletter] send failed", sub.email, e);
    }
  }

  await supabaseAdmin
    .from("newsletter_subscribers")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("status", "subscribed");

  return { sent };
}
