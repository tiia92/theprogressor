// Server-only: subscriber storage + the daily edition alert email.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendBrevoEmail, upsertBrevoContact, removeBrevoContact } from "@/lib/brevo.server";

export const SITE_URL = "https://theprogressor.lovable.app";

export async function subscribeEmail(
  rawEmail: string,
  options: { userId?: string | null } = {},
) {
  const email = rawEmail.trim().toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("newsletter_subscribers")
    .upsert(
      {
        email,
        status: "subscribed",
        ...(options.userId ? { user_id: options.userId } : {}),
      },
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
  category?: string | null;
  tags?: string[] | null;
  hero_image_url?: string | null;
}

/** Absolute URL for an article's cover image, looked up when not already loaded. */
export async function leadImageUrl(article: EditionArticle | undefined) {
  if (!article) return null;
  let url = article.hero_image_url ?? null;
  if (!url) {
    const { data } = await supabaseAdmin
      .from("articles")
      .select("hero_image_url")
      .eq("slug", article.slug)
      .maybeSingle();
    url = (data?.hero_image_url as string | null) ?? null;
  }
  if (!url) return null;
  return url.startsWith("http") ? url : `${SITE_URL}${url}`;
}

export function renderEdition(
  articles: EditionArticle[],
  token: string,
  date: string,
  coverImage?: string | null,
) {
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

  const cover = coverImage
    ? `<tr><td style="padding-bottom:22px;">
         <a href="${SITE_URL}/article/${articles[0]?.slug ?? ""}">
           <img src="${coverImage}" alt="" width="552" style="display:block;width:100%;max-width:552px;height:auto;border-radius:8px;border:0;" />
         </a>
       </td></tr>`
    : "";

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
        ${cover}
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

/** user_ids with a currently-valid Pro subscription in the given environment. */
async function activeProUserIds(userIds: string[], environment: string) {
  if (!userIds.length) return new Set<string>();
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, status, current_period_end")
    .in("user_id", userIds)
    .eq("environment", environment);
  const now = Date.now();
  const pro = new Set<string>();
  for (const row of data ?? []) {
    const future = !row.current_period_end || new Date(row.current_period_end).getTime() > now;
    if (["active", "trialing", "past_due", "canceled"].includes(row.status) && future) {
      pro.add(row.user_id as string);
    }
  }
  return pro;
}

function articlesForTopics(articles: EditionArticle[], topics: string[]) {
  if (!topics.length) return articles;
  const wanted = new Set(topics);
  const matched = articles.filter(
    (a) => wanted.has(a.category ?? "") || (a.tags ?? []).some((t) => wanted.has(t)),
  );
  return matched.length ? matched : articles;
}

/**
 * Emails the day's edition to Pro members on the daily cadence.
 * Personalized members get only the stories matching the topics they follow.
 */
export async function sendEditionAlert(articles: EditionArticle[], date: string) {
  if (!articles.length) return { sent: 0 };

  const environment = process.env['STRIPE_LIVE_API_KEY'] ? "live" : "sandbox";

  const { data: subs, error } = await supabaseAdmin
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token, user_id, personalized")
    .eq("status", "subscribed")
    .eq("cadence", "daily");
  if (error) throw new Error(error.message);
  if (!subs?.length) return { sent: 0 };

  const userIds = subs.map((s) => s.user_id).filter(Boolean) as string[];
  const pro = await activeProUserIds(userIds, environment);
  const eligible = subs.filter((s) => s.user_id && pro.has(s.user_id));
  if (!eligible.length) return { sent: 0 };

  const lead = articles.find((a) => a.article_type === "daily_brief") ?? articles[0];
  const subject = `The Progressor — ${lead.title}`;
  const cover = await leadImageUrl(lead);


  let sent = 0;
  for (const sub of eligible) {
    try {
      let list = articles;
      if (sub.personalized && sub.user_id) {
        const { data: topics } = await supabaseAdmin
          .from("followed_topics")
          .select("topic_slug")
          .eq("user_id", sub.user_id);
        list = articlesForTopics(
          articles,
          (topics ?? []).map((t) => t.topic_slug as string),
        );
      }
      await sendBrevoEmail({
        to: sub.email,
        subject,
        htmlContent: renderEdition(list, sub.unsubscribe_token, date, cover),
        textContent: list
          .map((a) => `${a.title}\n${a.dek}\n${SITE_URL}/article/${a.slug}`)
          .join("\n\n"),
      });
      sent++;
      await supabaseAdmin
        .from("newsletter_subscribers")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("email", sub.email);
    } catch (e) {
      console.error("[newsletter] send failed", sub.email, e);
    }
  }

  return { sent };
}

/** Free weekly roundup: the past seven days of articles, sent to weekly-cadence subscribers. */
export async function sendWeeklyDigest() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: articles } = await supabaseAdmin
    .from("articles")
    .select("slug, title, dek, article_type, category, tags, hero_image_url")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(12);
  if (!articles?.length) return { sent: 0 };

  const { data: subs, error } = await supabaseAdmin
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token")
    .eq("status", "subscribed")
    .eq("cadence", "weekly");
  if (error) throw new Error(error.message);
  if (!subs?.length) return { sent: 0 };

  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const subject = `The Progressor — this week's roundup`;
  const cover = await leadImageUrl(articles[0] as EditionArticle);

  let sent = 0;
  for (const sub of subs) {
    try {
      await sendBrevoEmail({
        to: sub.email,
        subject,
        htmlContent: renderEdition(articles as EditionArticle[], sub.unsubscribe_token, date, cover),

        textContent: articles
          .map((a) => `${a.title}\n${a.dek}\n${SITE_URL}/article/${a.slug}`)
          .join("\n\n"),
      });
      sent++;
    } catch (e) {
      console.error("[newsletter] weekly send failed", sub.email, e);
    }
  }

  await supabaseAdmin
    .from("newsletter_subscribers")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("status", "subscribed")
    .eq("cadence", "weekly");

  return { sent };
}

