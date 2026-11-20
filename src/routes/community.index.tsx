import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listArticles } from "@/lib/articles.functions";
import { listPartners, listPublicMembers } from "@/lib/public.functions";
import { EmptyBlock, ErrorBlock, LoadingBlock, Section, StatusPill } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/community/")({
  head: () => ({
    meta: [
      { title: "Community stories - CometX" },
      {
        name: "description",
        content:
          "Essays, pay surveys and notes from the CometX community. Some stories are open, some are for members.",
      },
      { property: "og:title", content: "CometX community stories" },
      {
        property: "og:description",
        content: "Essays, surveys and notes from Czech and Slovak professionals in Switzerland.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchArticles = useServerFn(listArticles);
  const fetchPartners = useServerFn(listPartners);
  const fetchMembers = useServerFn(listPublicMembers);
  const { data, isLoading, error } = useQuery({
    queryKey: ["articles"],
    queryFn: () => fetchArticles(),
  });
  const {
    data: partners,
    isLoading: partnersLoading,
    error: partnersError,
  } = useQuery({
    queryKey: ["partners"],
    queryFn: () => fetchPartners(),
  });
  const {
    data: members,
    isLoading: membersLoading,
    error: membersError,
  } = useQuery({
    queryKey: ["public-members"],
    queryFn: () => fetchMembers(),
  });
  const mediaLinks: {
    title: string;
    text: string;
    href?: string;
    to?: "/media" | "/community" | "/community/members";
    hash?: string;
  }[] = [
    {
      title: cs ? "Celá videa" : "Full videos",
      text: cs
        ? "Přednášky a rozhovory z akcí CometX na našem YouTube kanálu."
        : "Talks and interviews from CometX events on our YouTube channel.",
      href: "https://www.youtube.com/@cometx",
    },
    {
      title: cs ? "Fotogalerie" : "Gallery",
      text: cs
        ? "Atmosféra, setkání a nezapomenutelné momenty z minulých akcí."
        : "Atmosphere, encounters and memorable moments from previous events.",
      to: "/media",
    },
    {
      title: cs ? "Názory komunity" : "Community opinions",
      text: cs
        ? "Skutečné zkušenosti a názory lidí, kteří tvoří CometX."
        : "Real experiences and opinions from the people who make CometX.",
      to: "/community",
      hash: "#stories",
    },
    {
      title: cs ? "Členové komunity" : "Member directory",
      text: cs
        ? "Profily zveřejněné týmem CometX; kontaktní údaje zůstávají soukromé."
        : "Profiles published by the CometX team; contact details stay private.",
      to: "/community/members",
    },
  ];

  return (
    <>
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-14 lg:px-8 lg:pb-12 lg:pt-16">
          <p className="eyebrow text-muted-foreground">
            {cs ? "Komunita CometX" : "CometX community"}
          </p>
          <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
            {cs ? "Chci být vidět" : "Be part of the community"}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {cs
              ? "Veřejný adresář ukazuje jen profily, které tým CometX výslovně zveřejnil. Kontaktní údaje členů zůstávají soukromé."
              : "The public directory shows only profiles explicitly published by CometX. Members’ contact details remain private."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#community-members"
              className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 font-bold text-accent-foreground transition hover:brightness-95"
            >
              {cs ? "Členové komunity" : "Community members"}
            </a>
            <Link
              to="/contact"
              className="inline-flex min-h-12 items-center rounded-full border border-foreground px-6 font-semibold transition hover:bg-muted"
            >
              {cs ? "Kontaktovat CometX" : "Contact CometX"}
            </Link>
          </div>
        </div>
      </section>
      <Section id="community-members" className="bg-muted">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-muted-foreground">{cs ? "Adresář" : "Directory"}</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
              {cs ? "Členové komunity" : "Community members"}
            </h2>
          </div>
          <Link
            to="/community/members"
            className="inline-flex items-center gap-2 text-sm font-bold underline decoration-accent decoration-2 underline-offset-4"
          >
            {cs ? "Zobrazit adresář" : "Browse the directory"}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        {membersLoading && <LoadingBlock label={cs ? "Načítáme členy" : "Loading members"} />}
        {membersError && <ErrorBlock error={membersError} />}
        {members && members.length === 0 && (
          <EmptyBlock
            title={cs ? "Zatím nejsou zveřejněné žádné profily" : "No profiles are published yet"}
            hint={
              cs
                ? "CometX zveřejní pouze profil, který tým výslovně označil jako veřejný."
                : "CometX only displays profiles explicitly marked as public by the team."
            }
          />
        )}
        {members && members.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.slice(0, 6).map((member) => (
              <Link
                key={member.id}
                to="/community/members/$id"
                params={{ id: member.id }}
                className="rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="font-display text-xl font-bold">{member.name}</h3>
                {(member.jobTitle || member.company) && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {[member.jobTitle, member.company].filter(Boolean).join(" · ")}
                  </p>
                )}
                {member.country && (
                  <p className="mt-2 text-xs text-muted-foreground">{member.country}</p>
                )}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h3 className="font-display text-xl font-bold">
            {cs ? "Jak se profil zveřejní?" : "How does a profile become public?"}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {cs
              ? "Členové si mohou upravit své údaje ve svém účtu. O veřejném zobrazení vybraných údajů rozhoduje tým CometX; adresář nezobrazuje e-mail ani telefon."
              : "Members can update their details in their account. The CometX team controls whether selected details are shown publicly; the directory does not show email or phone numbers."}
          </p>
        </div>
      </Section>
      <Section id="stories">
        <div className="mb-8">
          <p className="eyebrow text-muted-foreground">
            {cs ? "Příběhy komunity" : "Community stories"}
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
            {cs ? "Názory a reportáže" : "Opinions and stories"}
          </h2>
        </div>
        {isLoading && <LoadingBlock label={cs ? "Načítáme příběhy" : "Loading stories"} />}
        {error && <ErrorBlock error={error} />}
        {data && data.length === 0 && (
          <EmptyBlock
            title={cs ? "Zatím nebyly publikovány žádné příběhy" : "No stories published yet"}
          />
        )}
        {data && data.length > 0 && (
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {data.map((article) => (
              <Link
                key={article.slug}
                to="/community/articles/$slug"
                params={{ slug: article.slug }}
                className="group flex flex-col"
              >
                <div className="aspect-[16/10] overflow-hidden rounded-3xl bg-muted">
                  {article.heroImageUrl && (
                    <img
                      src={article.heroImageUrl}
                      alt={!cs && article.titleEn?.trim() ? article.titleEn : article.title}
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="mt-5">
                  <div className="flex items-center gap-3">
                    <span className="eyebrow text-muted-foreground">
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString(cs ? "cs-CZ" : "en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : cs
                          ? "Koncept"
                          : "Draft"}
                    </span>
                    {article.visibility !== "public" && (
                      <StatusPill tone="muted">
                        {article.visibility === "registered"
                          ? cs
                            ? "S účtem"
                            : "Account"
                          : cs
                            ? "Pro členy"
                            : "Members"}
                      </StatusPill>
                    )}
                  </div>
                  <h2 className="mt-3 font-display text-xl font-bold leading-snug">
                    {!cs && article.titleEn?.trim() ? article.titleEn : article.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {!cs && article.excerptEn?.trim() ? article.excerptEn : article.excerpt}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
      <section className="border-y border-border bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {mediaLinks.map((item) =>
              item.href ? (
                <a
                  key={item.title}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group overflow-hidden rounded-2xl border border-border/60 bg-background p-7"
                >
                  <h2 className="font-display text-xl font-bold group-hover:underline">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground">{item.text}</p>
                </a>
              ) : (
                <Link
                  key={item.title}
                  to={item.to!}
                  {...(item.hash ? { hash: item.hash } : {})}
                  className="group overflow-hidden rounded-2xl border border-border/60 bg-background p-7"
                >
                  <h2 className="font-display text-xl font-bold group-hover:underline">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground">{item.text}</p>
                </Link>
              ),
            )}
          </div>
        </div>
      </section>
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-5">
          <div>
            <p className="eyebrow text-muted-foreground">{cs ? "Síť CometX" : "CometX network"}</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
              {cs ? "Partneři komunity" : "Community partners"}
            </h2>
          </div>
          <Link
            to="/partners"
            className="text-sm font-bold underline decoration-accent decoration-2 underline-offset-4"
          >
            {cs ? "Všichni partneři" : "All partners"} →
          </Link>
        </div>
        {partnersLoading && <LoadingBlock label={cs ? "Načítáme partnery" : "Loading partners"} />}
        {partnersError && <ErrorBlock error={partnersError} />}
        {partners && partners.length === 0 && (
          <EmptyBlock title={cs ? "Zatím tu nejsou aktivní partneři" : "No active partners yet"} />
        )}
        {partners && partners.length > 0 && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {partners.slice(0, 8).map((partner) => (
              <article
                key={partner.id}
                className="flex min-h-44 flex-col rounded-[1.25rem] border border-border/80 bg-card p-5"
              >
                {partner.logo_url && (
                  <img
                    src={partner.logo_url}
                    alt={`${partner.name} logo`}
                    loading="lazy"
                    className="mb-5 h-12 max-w-40 object-contain object-left"
                  />
                )}
                <h3 className="font-display text-lg font-bold">{partner.name}</h3>
                {partner.website_url && (
                  <a
                    href={partner.website_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-auto pt-4 text-sm font-semibold underline decoration-accent decoration-2 underline-offset-4"
                  >
                    {cs ? "Navštívit web" : "Visit website"}
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </Section>
      <section className="bg-accent text-accent-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 md:grid-cols-2 lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-extrabold">
              {cs ? "Připojte se k WhatsApp komunitě" : "Join the WhatsApp community"}
            </h2>
            <p className="mt-2 text-sm">
              {cs
                ? "Nové kontakty, sdílené zkušenosti a aktuální dění na jednom místě."
                : "New contacts, shared experiences and current community news in one place."}
            </p>
            <a
              href="https://chat.whatsapp.com/DczHatSCHRSADY6phvkdfe"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex bg-ink px-5 py-3 text-sm font-bold text-ink-foreground"
            >
              WhatsApp
            </a>
          </div>
          <div>
            <h2 className="font-display text-2xl font-extrabold">
              {cs ? "CometX newsletter" : "CometX newsletter"}
            </h2>
            <p className="mt-2 text-sm">
              {cs
                ? "Nové akce, nové kontakty, nová perspektiva. Přihlaste se přes formulář na konci stránky."
                : "New events, new contacts, new perspective. Subscribe using the form at the bottom of the page."}
            </p>
            <a
              href="#newsletter"
              className="mt-5 inline-flex rounded-full border border-ink px-5 py-3 text-sm font-bold"
            >
              {cs ? "Přihlásit newsletter" : "Subscribe"}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
