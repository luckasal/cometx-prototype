import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, MapPin, Users } from "lucide-react";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";
import { listPartners, listPublicMembers } from "@/lib/public.functions";

export const Route = createFileRoute("/community/members")({
  head: () => ({
    meta: [
      { title: "CometX members" },
      {
        name: "description",
        content: "Meet CometX members who are listed in the public directory.",
      },
    ],
  }),
  component: PublicMembersPage,
});

function PublicMembersPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchMembers = useServerFn(listPublicMembers);
  const fetchPartners = useServerFn(listPartners);
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-members"],
    queryFn: () => fetchMembers(),
  });
  const { data: partners } = useQuery({
    queryKey: ["partners"],
    queryFn: () => fetchPartners(),
  });
  const filteredMembers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((member) =>
      [member.name, member.company, member.jobTitle, member.country]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(term)),
    );
  }, [data, search]);

  return (
    <main className="bg-background">
      <section>
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-14 lg:px-8 lg:pb-12 lg:pt-16">
          <p className="eyebrow text-muted-foreground">{cs ? "Síť CometX" : "CometX network"}</p>
          <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight sm:text-6xl">
            {cs ? "Členové komunity" : "Community members"}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {cs
              ? "Představujeme členy, jejichž profil CometX výslovně zveřejnil. Kontaktní údaje zůstávají soukromé."
              : "Meet members whose profile CometX has explicitly published. Contact details remain private."}
          </p>
        </div>
      </section>
      <section className="bg-muted py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <label className="mb-7 block max-w-xl">
            <span className="mb-2 block text-sm font-semibold">
              {cs ? "Hledat v adresáři" : "Search the directory"}
            </span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={cs ? "Jméno, firma nebo místo" : "Name, company or location"}
              className="min-h-12 w-full rounded-xl border border-border bg-card px-4 text-base outline-none transition focus:border-foreground focus:ring-2 focus:ring-accent/50"
            />
          </label>
          {isLoading && <LoadingBlock label={cs ? "Načítáme členy" : "Loading members"} />}
          {error && <ErrorBlock error={error} />}
          {data && data.length === 0 && (
            <EmptyBlock
              title={cs ? "Zatím zde nejsou zveřejněné profily" : "No public profiles yet"}
              hint={
                cs
                  ? "V tomto seznamu se zobrazují pouze profily, které tým CometX výslovně zveřejnil."
                  : "Only profiles explicitly published by the CometX team appear here."
              }
            />
          )}
          {data && data.length > 0 && filteredMembers.length === 0 && (
            <EmptyBlock
              title={cs ? "Nic jsme nenašli" : "No matches found"}
              hint={
                cs
                  ? "Zkuste jiné jméno, firmu nebo místo."
                  : "Try another name, company or location."
              }
            />
          )}
          {data && filteredMembers.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMembers.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-md sm:p-7"
                >
                  <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Users className="size-6" aria-hidden="true" />
                  </div>
                  <h2 className="mt-5 font-display text-2xl font-bold">
                    <Link
                      to="/community/members/$id"
                      params={{ id: member.id }}
                      className="decoration-accent decoration-2 underline-offset-4 hover:underline"
                    >
                      {member.name}
                    </Link>
                  </h2>
                  {(member.jobTitle || member.company) && (
                    <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                      <BriefcaseBusiness className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>{[member.jobTitle, member.company].filter(Boolean).join(" · ")}</span>
                    </p>
                  )}
                  {member.country && (
                    <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>{member.country}</span>
                    </p>
                  )}
                  <p className="mt-5 text-xs text-muted-foreground">
                    {cs ? "Kontaktní údaje nejsou zveřejněny." : "Contact details are not public."}
                  </p>
                </article>
              ))}
            </div>
          )}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-card p-6 sm:p-8">
            <div>
              <p className="font-semibold">
                {cs ? "Chcete se přidat ke komunitě?" : "Want to join the community?"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {cs
                  ? "Podívejte se na aktuální plány členství CometX."
                  : "Explore the current CometX membership plans."}
              </p>
            </div>
            <Link
              to="/membership"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 font-bold text-accent-foreground transition hover:brightness-95"
            >
              {cs ? "Členství CometX" : "CometX membership"}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
      {partners && partners.length > 0 && (
        <section
          className="bg-background py-12 sm:py-16"
          aria-labelledby="community-partners-title"
        >
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-muted-foreground">{cs ? "Firmy" : "Companies"}</p>
                <h2
                  id="community-partners-title"
                  className="mt-2 font-display text-3xl font-extrabold sm:text-4xl"
                >
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {partners.slice(0, 8).map((partner) => (
                <article
                  key={partner.id}
                  className="flex min-h-36 flex-col justify-center rounded-2xl border border-border bg-card p-5"
                >
                  {partner.logo_url && (
                    <img
                      src={partner.logo_url}
                      alt={`${partner.name} logo`}
                      loading="lazy"
                      className="mb-4 h-10 max-w-40 object-contain object-left"
                    />
                  )}
                  <h3 className="font-display text-lg font-bold">{partner.name}</h3>
                  {partner.website_url && (
                    <a
                      href={partner.website_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 text-sm underline underline-offset-4"
                    >
                      {cs ? "Web partnera" : "Partner website"}
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
