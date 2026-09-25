import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PageHero, Section, SectionHeading } from "@/components/site/Bits";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/get-involved")({
  head: () => ({ meta: [{ title: "Get involved - CometX" }, { name: "description", content: "Volunteer and open positions at CometX." }] }),
  component: GetInvolvedPage,
});

function GetInvolvedPage() {
  const { language } = useLanguage();
  const cs = language === "cs";
  const roles = cs
    ? [
        ["Webmaster/ka · dobrovolník", "Správa webového obsahu, struktury, SEO a analytiky. Flexibilní práce na dálku."],
        ["Produkční · dobrovolník", "Koordinace týmů, termínů, interních setkání a projektů od nápadu po realizaci."],
        ["Copywriter/ka · dobrovolník", "Texty pro web, newslettery, rozhovory, reportáže a komunitní akce."],
      ]
    : [
        ["Webmaster · volunteer", "Website content, structure, SEO and analytics. Flexible remote involvement."],
        ["Production coordinator · volunteer", "Coordinate teams, deadlines, internal meetings and projects from idea to delivery."],
        ["Copywriter · volunteer", "Write for the website, newsletters, interviews, event reports and community activities."],
      ];
  const benefits = cs
    ? ["Tvorba unikátní komunity krajanů", "Zkušenosti s akcemi, marketingem a soft skills", "Setkání se zajímavými osobnostmi", "Prostor pro vlastní nápady", "Flexibilní zapojení — počítají se i dvě hodiny týdně"]
    : ["Help build a unique expat community", "Gain event, marketing and soft-skill experience", "Meet inspiring personalities", "Bring your own ideas", "Flexible involvement — even two hours per week counts"];

  return <>
    <PageHero eyebrow={cs ? "Zapojte se" : "Get involved"} title={cs ? "Přidejte se k týmu CometX" : "Join the CometX team"} lead={cs ? "Neustále hledáme nové a nadšené lidi, kteří souzní s naším posláním a chtějí pomáhat česko-slovenské komunitě ve Švýcarsku." : "We are always looking for enthusiastic people who share our mission and want to support the Czech and Slovak community in Switzerland."} />
    <Section>
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div><SectionHeading eyebrow={cs ? "Co získáte" : "What you gain"} title={cs ? "Smysluplná práce a skvělý tým" : "Meaningful work with a great team"} />
          <ul className="space-y-3">{benefits.map((item) => <li key={item} className="flex gap-3 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-signal" />{item}</li>)}</ul>
        </div>
        <div><SectionHeading eyebrow={cs ? "Otevřené role" : "Open roles"} title={cs ? "Kde můžete pomoci" : "Where you can help"} />
          <div className="space-y-4">{roles.map(([title, text]) => <article key={title} className="rounded-2xl border border-border/60 p-6"><h2 className="font-display text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{text}</p></article>)}</div>
          <p className="mt-7 text-sm text-muted-foreground">{cs ? "Pošlete CV a pár slov o své motivaci přímo Adamovi." : "Send your CV and a few words about your motivation directly to Adam."}</p>
          <a href="mailto:adam.pruska@cometx.ch" className="mt-4 inline-flex bg-ink px-5 py-3 text-sm font-bold text-ink-foreground">adam.pruska@cometx.ch</a>
        </div>
      </div>
    </Section>
  </>;
}
