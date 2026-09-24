import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-ink-foreground">
      <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" aria-label="CometX - Come and Meet Expats">
              <img src="/cometx-official-logo.png" alt="CometX - Come and Meet Expats" className="h-36 w-auto object-contain" />
            </Link>
            <p className="mt-4 max-w-sm text-sm text-ink-foreground/65">
              A Swiss nonprofit connecting Czech and Slovak expats through education, culture and a
              professional network with a touch of homeland.
            </p>
            <address className="mt-5 not-italic text-xs leading-6 text-ink-foreground/55">
              CHE-424.450.235<br />
              Untere Vogelsangstrasse 193, 8400 Winterthur<br />
              <a href="mailto:info@cometx.ch" className="hover:text-accent">info@cometx.ch</a>
            </address>
          </div>

          <FooterColumn
            title="Community"
            links={[
              { to: "/events", label: "Events" },
              { to: "/community", label: "Stories" },
              { to: "/membership", label: "Membership" },
            ]}
          />
          <FooterColumn
            title="Organisation"
            links={[
              { to: "/about", label: "About" },
              { to: "/partners", label: "Partners" },
            ]}
          />
          <FooterColumn
            title="Account"
            links={[
              { to: "/login", label: "Log in" },
              { to: "/register", label: "Create account" },
              { to: "/account", label: "My CometX" },
            ]}
          />
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-ink-foreground/15 pt-6 text-xs text-ink-foreground/50 sm:flex-row sm:justify-between">
          <span>&copy; {new Date().getFullYear()} CometX - Come and Meet Expats</span>
          <span className="flex gap-4">
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
