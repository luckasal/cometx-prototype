import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPartners } from "@/lib/public.functions";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PageHero,
  Section,
  StatusPill,
} from "@/components/site/Bits";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Partners - CometX" },
      {
        name: "description",
        content: "The companies and institutions that support CometX events across Switzerland.",
      },
      { property: "og:title", content: "CometX partners" },
      {
        property: "og:description",
        content: "Companies and institutions supporting the Czech and Slovak community in Switzerland.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartnersPage,
});

function PartnersPage() {
  const fetchPartners = useServerFn(listPartners);
  const { data, isLoading, error } = useQuery({
    queryKey: ["partners"],
    queryFn: () => fetchPartners(),
  });

  return (
    <>
      <PageHero
        eyebrow="Partners"
        title="CometX partners"
        lead="Our partners help Czech and Slovak expats with strong ties to Switzerland meet, grow and create new opportunities together."
      />
      <Section>
        {isLoading && <LoadingBlock label="Loading partners" />}
        {error && <ErrorBlock error={error} />}
        {data && data.length === 0 && <EmptyBlock title="No partners listed yet" />}
        {data && data.length > 0 && (
          <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {data.map((partner) => (
              <div key={partner.id} className="flex flex-col bg-card p-8">
                {partner.logo_url && (
                  <div className="mb-6 flex h-32 items-center justify-center rounded-lg bg-white p-4">
                    <img src={partner.logo_url} alt={`${partner.name} logo`} className="max-h-full max-w-full object-contain" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-display text-xl font-bold">{partner.name}</h2>
                  <StatusPill tone="muted">{partner.tier}</StatusPill>
                </div>
                {partner.description && (
                  <p className="mt-3 flex-1 text-sm text-muted-foreground">{partner.description}</p>
                )}
                {partner.website_url && (
                  <a
                    href={partner.website_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-6 text-sm underline underline-offset-4"
                  >
                    Visit website
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-12 border-t border-border pt-8 text-sm text-muted-foreground">
          <p>Interested in working with CometX?</p>
          <p className="mt-2">
            Czech Republic: <a href="mailto:jan.mastny@cometx.ch" className="underline underline-offset-4">Jan Mastný</a>
            {" · "}Slovakia: <a href="mailto:gleb.kopylov@cometx.ch" className="underline underline-offset-4">Gleb Kopylov</a>
          </p>
        </div>
      </Section>
    </>
  );
}
