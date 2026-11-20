import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BriefcaseBusiness, MapPin } from "lucide-react";
import { ErrorBlock, LoadingBlock } from "@/components/site/Bits";
import { getPublicMemberProfile } from "@/lib/public.functions";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/community/members/$id")({
  component: PublicMemberProfilePage,
});

function PublicMemberProfilePage() {
  const { id } = Route.useParams();
  const { language } = useLanguage();
  const cs = language === "cs";
  const fetchProfile = useServerFn(getPublicMemberProfile);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-member", id],
    queryFn: () => fetchProfile({ data: { memberId: id } }),
  });

  return (
    <main className="bg-background">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 lg:px-8 lg:pb-24 lg:pt-14">
        <Link
          to="/community/members"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {cs ? "Zpět na členy komunity" : "Back to community members"}
        </Link>
        {isLoading && <LoadingBlock label={cs ? "Načítáme profil" : "Loading profile"} />}
        {error && <ErrorBlock error={error} />}
        {!isLoading && !error && !data && (
          <div className="mt-8 rounded-3xl border border-border bg-muted p-8">
            <p className="eyebrow text-muted-foreground">CometX</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold">
              {cs ? "Profil není dostupný" : "Profile unavailable"}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {cs
                ? "Profil už není zveřejněný nebo členství není aktivní. Veřejný adresář zobrazuje pouze profily, které CometX výslovně zveřejnil."
                : "This profile is no longer published or the membership is not active. The public directory only shows profiles explicitly published by CometX."}
            </p>
          </div>
        )}
        {data && (
          <article className="mt-8 max-w-3xl rounded-3xl border border-border bg-card p-7 sm:p-10">
            <p className="eyebrow text-muted-foreground">
              {cs ? "Člen komunity CometX" : "CometX community member"}
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              {data.name}
            </h1>
            {(data.jobTitle || data.company) && (
              <p className="mt-6 flex items-start gap-3 text-base text-muted-foreground">
                <BriefcaseBusiness className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <span>{[data.jobTitle, data.company].filter(Boolean).join(" · ")}</span>
              </p>
            )}
            {data.country && (
              <p className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <MapPin className="size-5 shrink-0" aria-hidden="true" />
                {data.country}
              </p>
            )}
            <p className="mt-8 border-t border-border pt-5 text-sm text-muted-foreground">
              {cs
                ? "Zobrazujeme pouze údaje, které CometX zveřejnil. Kontaktní údaje zůstávají soukromé."
                : "Only information published by CometX is shown. Contact details remain private."}
            </p>
          </article>
        )}
      </div>
    </main>
  );
}
