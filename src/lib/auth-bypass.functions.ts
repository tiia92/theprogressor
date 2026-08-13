import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Emails allowed to skip the email-confirmation step.
const ALLOWLIST = new Set(["discussabilityonline@gmail.com"]);

export const confirmAllowlistedEmail = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!ALLOWLIST.has(email)) return { confirmed: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find the user by email (small user base; paginate a few pages defensively).
    for (let page = 1; page <= 5; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const user = list.users.find((u) => u.email?.toLowerCase() === email);
      if (user) {
        if (user.email_confirmed_at) return { confirmed: true };
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email_confirm: true,
        });
        if (updateError) throw new Error(updateError.message);
        return { confirmed: true };
      }
      if (!list.users.length || list.users.length < 200) break;
    }
    return { confirmed: false };
  });
