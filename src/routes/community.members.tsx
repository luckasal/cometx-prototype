import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BriefcaseBusiness, MapPin, Users } from "lucide-react";
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHero, Section } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";
import { listPublicMembers } from "@/lib/public.functions";

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
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-members"],
    queryFn: () => fetchMembers(),
  });

  return (
    <>
      <PageHero
        tone="brand"
        eyebrow={cs ? "Síť CometX" : "CometX network"}
        title={cs ? "Členové komunity" : "Community members"}
        lead={
          cs
            ? "Představujeme členy, jejichž profil CometX zveřejnil. Kontaktní údaje zůstávají soukromé."
            : "Meet members whose profiles CometX has chosen to publish. Their contact details stay private."
        }
      />
      <Section>
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
        {data && data.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((member, index) => (
              <article
                key={`${member.name}-${member.company ?? ""}-${index}`}
                className="rounded-[1.5rem] border border-border/80 bg-card p-6 sm:p-7"
              >
                <div className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
                  <Users className="size-6" aria-hidden="true" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-bold">{member.name}</h2>
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
              </article>
            ))}
          </div>
        )}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] bg-paper p-6 sm:p-8">
          <p className="font-semibold">
            {cs ? "Chcete se přidat ke komunitě?" : "Want to join the community?"}
          </p>
          <Link
            to="/membership"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 font-bold text-ink-foreground transition-colors hover:bg-ink/85"
          >
            {cs ? "Členství CometX" : "CometX membership"}
          </Link>
        </div>
      </Section>
    </>
  );
}
