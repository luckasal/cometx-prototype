import { Link } from "@tanstack/react-router";
import { CometXLogo } from "./CometXLogo";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { subscribeNewsletter } from "@/lib/public.functions";
import { trackEvent } from "@/lib/analytics";

export function SiteFooter() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const [email, setEmail] = useState("");
  const subscribe = useServerFn(subscribeNewsletter);
  const signup = useMutation({ mutationFn: () => subscribe({ data: { email } }), onSuccess: () => { trackEvent("newsletter_signup", { placement: "footer" }); toast.success(cs ? "Jste přihlášeni k odběru." : "You're subscribed."); setEmail(""); }, onError: (error: Error) => toast.error(error.message) });
  return (
    <footer className="mt-24 bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.4fr_0.8fr_1.3fr_0.9fr_0.8fr] [&>div]:min-w-0">
          <div>
            <CometXLogo footer />
            <p className="mt-4 max-w-sm text-sm text-ink-foreground/65">
              {cs ? "Švýcarská nezisková organizace propojující české a slovenské expaty prostřednictvím vzdělávání, kultury a profesní sítě s dotekem domova." : "A Swiss nonprofit connecting Czech and Slovak expats through education, culture and a professional network with a touch of homeland."}
            </p>
            <address className="mt-5 not-italic text-xs leading-6 text-ink-foreground/55">
              CHE-424.450.235<br />
              Untere Vogelsangstrasse 193, 8400 Winterthur<br />
              <a href="mailto:info@cometx.ch" className="hover:text-accent">info@cometx.ch</a>
              <br />IBAN: CH98 0026 9269 1309 2601 K
              <br />BIC: UBSWCHZH80A
            </address>
          </div>

          <FooterColumn
            title={cs ? "Komunita" : "Community"}
            links={[
              { to: "/events", label: cs ? "Akce" : "Events" },
              { to: "/community", label: cs ? "Příběhy" : "Stories" },
              { to: "/membership", label: cs ? "Členství" : "Membership" },
            ]}
          />
          <div>
            <h4 className="eyebrow text-ink-foreground/45">{cs ? "Newsletter" : "Newsletter"}</h4>
            <p className="mt-4 text-sm text-ink-foreground/65">{cs ? "Novinky o akcích a komunitě, přímo do schránky." : "Event and community news, straight to your inbox."}</p>
            <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); signup.mutate(); }}>
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="min-w-0 flex-1 rounded-full border border-ink-foreground/30 bg-transparent px-3 py-2 text-sm text-ink-foreground placeholder:text-ink-foreground/35" />
              <button disabled={signup.isPending} className="rounded-full bg-accent px-3 py-2 text-xs font-bold text-accent-foreground">{signup.isPending ? "…" : (cs ? "Odebírat" : "Subscribe")}</button>
            </form>
          </div>
          <FooterColumn
            title={cs ? "Organizace" : "Organisation"}
            links={[
              { to: "/about", label: cs ? "O nás" : "About" },
              { to: "/partners", label: cs ? "Partneři" : "Partners" },
              { to: "/get-involved", label: cs ? "Volné pozice" : "Open positions" },
            ]}
          />
          <FooterColumn
            title={cs ? "Účet" : "Account"}
            links={[
              { to: "/login", label: cs ? "Přihlásit" : "Log in" },
              { to: "/register", label: cs ? "Vytvořit účet" : "Create account" },
              { to: "/account", label: cs ? "Můj CometX" : "My CometX" },
            ]}
          />
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-ink-foreground/15 pt-6 text-xs text-ink-foreground/50 sm:flex-row sm:justify-between">
          <span>&copy; {new Date().getFullYear()} CometX - Come and Meet Expats</span>
          <span className="flex flex-wrap gap-4">
            <a href="https://www.cometx.ch/_files/ugd/41f758_b4416cc4324a440fae43acc5bf10defd.pdf" target="_blank" rel="noreferrer noopener" className="hover:text-accent">{cs ? "Obchodní podmínky" : "Terms"}</a>
            <a href="https://www.cometx.ch/_files/ugd/41f758_cf8654296bfe4790be7ac44abfe07fbd.pdf" target="_blank" rel="noreferrer noopener" className="hover:text-accent">{cs ? "Ochrana soukromí" : "Privacy"}</a>
            <a href="https://www.instagram.com/cometx_ch/" target="_blank" rel="noreferrer noopener" className="hover:text-accent">Instagram</a>
            <a href="https://www.linkedin.com/in/cometx-ch" target="_blank" rel="noreferrer noopener" className="hover:text-accent">LinkedIn</a>
            <a href="https://www.youtube.com/@cometx" target="_blank" rel="noreferrer noopener" className="hover:text-accent">YouTube</a>
            <a href="https://chat.whatsapp.com/DczHatSCHRSADY6phvkdfe" target="_blank" rel="noreferrer noopener" className="hover:text-accent">WhatsApp</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="eyebrow text-ink-foreground/45">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="text-sm text-ink-foreground/80 hover:text-accent">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
