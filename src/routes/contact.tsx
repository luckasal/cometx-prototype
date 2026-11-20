import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero, Section } from "@/components/site/Bits";
import { sendContactMessage } from "@/lib/contact.functions";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact CometX" },
      {
        name: "description",
        content: "Contact CometX about membership, events, media or partnerships.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const send = useServerFn(sendContactMessage);
  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: "other" as "partnership" | "media" | "speaking" | "membership" | "other",
    message: "",
    website: "",
  });
  const [sent, setSent] = useState(false);
  const mutation = useMutation({
    mutationFn: () => send({ data: { ...form, submissionId: crypto.randomUUID() } }),
    onSuccess: () => {
      setSent(true);
      setForm({ name: "", email: "", topic: "other", message: "", website: "" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHero
        tone="light"
        eyebrow={cs ? "Kontakt a média" : "Contact and media"}
        title={cs ? "Kontakt a média" : "Contact and media"}
        lead={
          cs
            ? "Ozvěte se nám s otázkami k členství, akcím, médiím nebo partnerství."
            : "Reach out with questions about membership, events, media or partnerships."
        }
      />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="space-y-6">
            <div className="rounded-[1.5rem] bg-ink p-7 text-ink-foreground sm:p-8">
              <h2 className="font-display text-2xl font-extrabold">CometX</h2>
              <a
                href="mailto:info@cometx.ch"
                className="mt-5 inline-flex items-center gap-2 text-accent underline underline-offset-4"
              >
                <Mail className="size-4" />
                info@cometx.ch
                <ArrowUpRight className="size-4" />
              </a>
              <p className="mt-6 flex gap-3 text-sm leading-relaxed text-ink-foreground/75">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                Untere Vogelsangstrasse 193
                <br />
                8400 Winterthur, Switzerland
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-border/80 p-7">
              <h2 className="font-display text-xl font-bold">{cs ? "Pro média" : "For media"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {cs
                  ? "Pro mediální dotazy nám napište a do předmětu uveďte Média."
                  : "For media enquiries, write to us and choose Media as the topic."}
              </p>
            </div>
          </aside>

          <div className="rounded-[1.5rem] border border-border/80 bg-card p-6 sm:p-9">
            <h2 className="font-display text-2xl font-extrabold">
              {cs ? "Napište nám zprávu" : "Send us a message"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {cs
                ? "Vaši zprávu předáme týmu CometX. Nepřidáváme vás tím do newsletteru."
                : "Your message goes to the CometX team. It does not subscribe you to the newsletter."}
            </p>
            {sent ? (
              <div
                role="status"
                className="mt-7 rounded-2xl border border-success/40 bg-success/10 p-5 text-sm"
              >
                <p className="font-bold">
                  {cs ? "Děkujeme, zpráva byla odeslána." : "Thanks, your message was sent."}
                </p>
                <button
                  type="button"
                  className="mt-3 font-semibold underline underline-offset-4"
                  onClick={() => setSent(false)}
                >
                  {cs ? "Poslat další zprávu" : "Send another message"}
                </button>
              </div>
            ) : (
              <form
                className="mt-7 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate();
                }}
              >
                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="contact-website">Website</label>
                  <input
                    id="contact-website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(event) => setForm({ ...form, website: event.target.value })}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold" htmlFor="contact-name">
                    {cs ? "Jméno" : "Name"}
                    <input
                      id="contact-name"
                      required
                      maxLength={120}
                      autoComplete="name"
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      className="min-h-12 rounded-xl border border-input bg-background px-4 font-normal"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold" htmlFor="contact-email">
                    E-mail
                    <input
                      id="contact-email"
                      required
                      type="email"
                      maxLength={320}
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                      className="min-h-12 rounded-xl border border-input bg-background px-4 font-normal"
                    />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-semibold" htmlFor="contact-topic">
                  {cs ? "Téma" : "Topic"}
                  <select
                    id="contact-topic"
                    value={form.topic}
                    onChange={(event) =>
                      setForm({ ...form, topic: event.target.value as typeof form.topic })
                    }
                    className="min-h-12 rounded-xl border border-input bg-background px-4 font-normal"
                  >
                    <option value="partnership">{cs ? "Partnerství" : "Partnership"}</option>
                    <option value="media">{cs ? "Média" : "Media"}</option>
                    <option value="speaking">
                      {cs ? "Vystoupení na akci" : "Speak at an event"}
                    </option>
                    <option value="membership">{cs ? "Členství" : "Membership"}</option>
                    <option value="other">{cs ? "Jiné" : "Other"}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold" htmlFor="contact-message">
                  {cs ? "Zpráva" : "Message"}
                  <textarea
                    id="contact-message"
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={6}
                    value={form.message}
                    onChange={(event) => setForm({ ...form, message: event.target.value })}
                    className="rounded-xl border border-input bg-background px-4 py-3 font-normal"
                  />
                </label>
                <Button type="submit" variant="ink" size="lg" disabled={mutation.isPending}>
                  {mutation.isPending
                    ? cs
                      ? "Odesíláme…"
                      : "Sending…"
                    : cs
                      ? "Odeslat zprávu"
                      : "Send message"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}
