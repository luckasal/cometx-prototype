import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { teamPhoto } from "@/lib/team-photos";
import { PageHero, Section, SectionHeading } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { language } = useLanguage();
  const cs = language === "cs";
  return (
    <>
      <PageHero
        eyebrow={cs ? "O nás" : "About"}
        title={cs ? "Poslání a tým" : "Mission and team"}
        lead={cs ? "CometX je aktivní švýcarská nezisková organizace založená krajany s českými a slovenskými kořeny. Naše akce znovu propojují lidi s domovem a zároveň ve Švýcarsku vytvářejí novou energii, nápady a přátelství." : "CometX is an active Swiss nonprofit founded by expats with Czech and Slovak roots. Our events reconnect people with home while creating new energy, ideas and friendships in Switzerland."}
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-5 text-[17px] leading-relaxed text-foreground/85">
            <p>
              {cs ? "Spojujeme studenty, akademiky, profesionály, zakladatele firem, umělce a zástupce společností. Chceme propojovat lidi navzájem i s institucemi a firmami ve Švýcarsku a v našich domovských zemích." : "We bring together students, academics, professionals, founders, artists and company representatives. The aim is to connect people with one another as well as with institutions and companies across Switzerland and our home countries."}
            </p>
            <p>
              {cs ? "Networkingem, debatami, konferencemi a workshopy pomáhá CometX rozvíjet profesní i osobní vztahy. Ukazujeme úspěchy krajanů a vytváříme prostor pro rozhovory o vědě, byznysu, průmyslu, umění i společnosti." : "Through networking, debates, conferences and workshops, CometX helps people grow their professional and personal relationships. We showcase expat achievements and create space for conversations spanning science, business, industry, art and society."}
            </p>
            <p>
              {cs ? "Organizace vyrostla ze známého pocitu krajanů: vzdálenosti od domova, spoluobčanů a kultury. CometX tuto vzdálenost mění v most pro znalosti, talent a nápady." : "The organization grew from a familiar expat feeling: distance from home, compatriots and culture. CometX turns that distance into a bridge for knowledge, talent and ideas."}
            </p>
          </div>

          <div className="space-y-10">
            <div className="rule-top pt-5">
               <h3 className="font-display text-lg font-bold">{cs ? "Kdo se může přidat" : "Who can join"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                 {cs ? "Součástí komunity jsou akademici, studenti, zakladatelé startupů, profesionálové, podnikatelé i umělci." : "Academics, students, startup founders, professionals, entrepreneurs and artists are all part of the community."}
              </p>
            </div>
            <div className="rule-top pt-5">
               <h3 className="font-display text-lg font-bold">{cs ? "Proč se přidat" : "Why join"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                 {cs ? "Sdílejte talent a znalosti, budujte profesní kontakty i přátelství, sledujte chystané akce a představte vlastní práci nebo příběh." : "Share talent and knowledge, build professional contacts and friendships, follow upcoming events and present your own work or story."}
              </p>
            </div>
            <div className="rule-top pt-5">
              <h3 className="font-display text-lg font-bold">{cs ? "Jak se zapojit" : "Getting involved"}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                 {cs ? "CometX vítá motivované dobrovolníky. Aktuálně hledáme pomoc s webem, produkcí a texty; zapojení je flexibilní už od přibližně dvou hodin týdně." : "CometX welcomes motivated volunteers. Current opportunities include web, production and copywriting roles, with flexible involvement from around two hours a week."}
              </p>
            </div>
          </div>
        </div>
      </Section>

      <section className="border-y border-border bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <SectionHeading eyebrow={cs ? "Lidé" : "People"} title={cs ? "Tým CometX" : "The CometX team"} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              <div key={name} className="rounded-3xl bg-background p-6">
                <img src={teamPhoto(name)} alt={name} loading="lazy" className="mb-5 aspect-[4/5] w-full rounded-lg object-cover" />
                <h3 className="font-display text-lg font-bold">{name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{role}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            {cs ? "Dobrovolníci" : "Volunteers"}: Gabriela Toscano, Peter Horváth, Jan Dufek {cs ? "a" : "and"} Veronika Štrublová.
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <SectionHeading eyebrow={cs ? "Další krok" : "Next step"} title={cs ? "Než se rozhodnete, přijďte na jednu akci" : "Come to one event before you decide"} />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="ink" size="lg">
              <Link to="/events">{cs ? "Zobrazit kalendář" : "See the calendar"}</Link>
            </Button>
            <Button asChild variant="outlineInk" size="lg">
              <Link to="/membership">{cs ? "Porovnat členství" : "Compare memberships"}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
