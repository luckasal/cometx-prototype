import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const inputSchema = z.object({
  submissionId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  topic: z.enum(["partnership", "media", "speaking", "membership", "other"]),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(500).optional().default(""),
});

const recentRequests = new Map<string, number[]>();

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    // Quietly accept the honeypot so bots do not learn that it was detected.
    if (data.website.trim()) return { ok: true };

    const request = getRequest();
    const address =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const now = Date.now();
    const active = (recentRequests.get(address) ?? []).filter(
      (sentAt) => now - sentAt < 60 * 60 * 1000,
    );
    if (active.length >= 5)
      throw new Error("Too many messages were sent. Please email info@cometx.ch instead.");
    active.push(now);
    recentRequests.set(address, active);
    if (recentRequests.size > 5000) {
      for (const [key, times] of recentRequests) {
        if (times.every((sentAt) => now - sentAt >= 60 * 60 * 1000)) recentRequests.delete(key);
      }
    }

    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["RESEND_FROM_EMAIL"];
    if (!apiKey || !from)
      throw new Error(
        "The contact form is temporarily unavailable. Please email info@cometx.ch directly.",
      );

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `cometx-contact-${data.submissionId}`,
      },
      body: JSON.stringify({
        from,
        to: ["info@cometx.ch"],
        reply_to: data.email,
        subject: `CometX website contact: ${data.topic}`,
        text: `From: ${data.name}\nEmail: ${data.email}\nTopic: ${data.topic}\n\n${data.message}`,
      }),
    });
    if (!response.ok)
      throw new Error("Your message could not be sent. Please email info@cometx.ch directly.");
    return { ok: true };
  });
