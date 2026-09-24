import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { teamPhoto } from "@/lib/team-photos";
import { PageHero, Section, SectionHeading } from "@/components/site/Bits";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About CometX" },
      {
        name: "description",
        content:
          "CometX connects Czech and Slovak professionals living in Switzerland through events, membership and a working network.",
      },
      { property: "og:title", content: "About CometX" },
      {
        property: "og:description",
        content: "Who we are, how the association works and how to get involved.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Mission and team"
        lead="CometX is an active Swiss nonprofit founded by expats with Czech and Slovak roots. Our events reconnect people with home while creating new energy, ideas and friendships in Switzerland."
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-5 text-[17px] leading-relaxed text-foreground/85">
            <p>
              We bring together students, academics, professionals, founders, artists and company
              representatives. The aim is to connect people with one another as well as with
              institutions and companies across Switzerland and our home countries.
            </p>
            <p>
              Through networking, debates, conferences and workshops, CometX helps people grow their
              professional and personal relationships. We showcase expat achievements and create
              space for conversations spanning science, business, industry, art and society.
            </p>
            <p>
              The organization grew from a familiar expat feeling: distance from home, compatriots
              and culture. CometX turns that distance into a bridge for knowledge, talent and ideas.
            </p>
          </div>

          <div className="space-y-10">
            <div className="rule-top pt-5">
               <h3 className="font-display text-lg font-bold">Who can join</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                 Academics, students, startup founders, professionals, entrepreneurs and artists are
                 all part of the community.
              </p>
            </div>
            <div className="rule-top pt-5">
               <h3 className="font-display text-lg font-bold">Why join</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                 Share talent and knowledge, build professional contacts and friendships, follow
                 upcoming events and present your own work or story.
              </p>
            </div>
            <div className="rule-top pt-5">
              <h3 className="font-display text-lg font-bold">Getting involved</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                 CometX welcomes motivated volunteers. Current opportunities include web, production
                 and copywriting roles, with flexible involvement from around two hours a week.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <section className="border-y border-border bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <SectionHeading eyebrow="People" title="The CometX team" />
          <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Adam Pruška", "President, Co-founder"],
              ["Jan Mastný", "Business Development, Board Member"],
              ["Míša Dohnálková", "Board Member"],
              ["Júlia Šťastná", "Social Marketing Board Member"],
              ["Aleš Holfeld", "Team Member, Co-founder"],
              ["Dana Müller", "Legal Affairs"],
              ["Lucie Piecková", "Data Analyst"],
              ["Helena Šmejkalová", "Workshop Expert"],
              ["Natálie Lokvencová", "Marketing Generalist"],
              ["Gleb Kopylov", "Business Development SK"],
              ["Jana Valnohová", "Team Member"],
              ["Tomáš Polák", "Team Member"],
              ["Peter Molnár", "Patron"],
              ["Michal Juríček", "Patron"],
              ["Adam Majcher", "Co-founder"],
            ].map(([name, role]) => (
              <div key={name} className="bg-background p-6">
                <img src={teamPhoto(name)} alt={name} loading="lazy" className="mb-5 aspect-[4/5] w-full rounded-lg object-cover" />
                <h3 className="font-display text-lg font-bold">{name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{role}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Volunteers: Gabriela Toscano, Peter Horváth, Jan Dufek and Veronika Štrublová.
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <SectionHeading eyebrow="Next step" title="Come to one event before you decide" />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="ink" size="lg">
              <Link to="/events">See the calendar</Link>
            </Button>
            <Button asChild variant="outlineInk" size="lg">
              <Link to="/membership">Compare memberships</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
