import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public newsletter signup for daily edition alerts. */
export const subscribeToNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email().max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { subscribeEmail } = await import("@/lib/newsletter.server");
    await subscribeEmail(data.email);
    return { ok: true };
  });
