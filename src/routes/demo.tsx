import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CheckCircle2, CalendarDays, Users, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-symposium.jpg";

export const Route = createFileRoute("/demo")({
  head: () => ({ meta: [{ title: "CometX | Interactive presentation" }, { name: "robots", content: "noindex" }] }),
  component: Demo,
});

function Demo() {
  const [role, setRole] = useState<"Visitor" | "Member" | "Organiser">("Visitor");
  const [member, setMember] = useState(false);
  const [reserved, setReserved] = useState(false);
  const [published, setPublished] = useState(true);
  const [message, setMessage] = useState("");
  const reset = () => { setRole("Visitor"); setMember(false); setReserved(false); setPublished(true); setMessage("Demo reset. Ready for a new walkthrough."); };
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
        <div><p className="text-sm font-bold text-accent">INTERACTIVE PROTOTYPE · SAMPLE DATA</p><p className="mt-1 text-sm text-muted-foreground">No real payment, login or database changes. This demo resets on refresh.</p></div>
        <Button variant="outline" size="sm" onClick={reset}>Reset demo</Button>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div><p className="eyebrow text-accent">Come and Meet Expats</p><h1 className="display-lg mt-3">One community. Every connection.</h1><p className="mt-4 max-w-2xl text-muted-foreground">Explore the journey from first visit to membership, event reservation and community management.</p></div>
        <Button asChild variant="outline"><Link to="/">Explore the website <ArrowRight className="size-4" /></Link></Button>
      </div>
      <div className="my-8 flex flex-wrap gap-2" aria-label="Demo perspective">
        {(["Visitor", "Member", "Organiser"] as const).map((item, index) => <Button key={item} variant={role === item ? "signal" : "outline"} aria-pressed={role === item} onClick={() => { setRole(item); setMessage(""); }}>{index + 1}. {item}</Button>)}
      </div>
      <p role="status" aria-live="polite" className="mb-4 min-h-6 text-sm text-accent">{message}</p>
      {role !== "Organiser" ? <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative h-64"><img src={heroImage} alt="CometX community gathering" className="size-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" /><div className="absolute bottom-6 left-6"><span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{published ? "REGISTRATION OPEN · DEMO" : "DRAFT · DEMO PREVIEW"}</span><h2 className="mt-4 text-3xl font-bold text-white">CometX Annual Symposium</h2></div></div>
          <div className="p-6"><p className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4" /> Zürich · Sample event · Date to be confirmed</p><p className="mt-5 text-lg">Ideas that travel. Connections that stay.</p><p className="mt-3 text-muted-foreground">Meet Czech and Slovak professionals in Switzerland for inspiring talks, practical workshops and conversations with people who share your roots.</p><div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5">{["Expert talks", "Workshops", "Networking"].map(x => <p key={x} className="text-sm font-semibold">{x}</p>)}</div></div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-6 lg:p-8">
          <p className="eyebrow text-accent">{role === "Member" ? "My CometX · Alex Novák (sample)" : "Your place in the community"}</p>
          <h2 className="mt-4 text-2xl font-bold">{role === "Member" ? "Welcome back, Alex." : "Start with a connection."}</h2>
          <p className="mt-4 text-muted-foreground">{member ? "Your demo membership is active. Your member ticket benefit is applied automatically." : "Try becoming a member to see how event benefits and reservations work together."}</p>
          <div className="my-6 rounded-xl bg-muted/40 p-5"><p className="text-sm text-muted-foreground">Illustrative symposium ticket</p><p className="mt-2 text-4xl font-bold">{member ? "Included" : "CHF 120"}</p><p className="mt-2 text-xs text-muted-foreground">Sample pricing and benefits for presentation only.</p></div>
          {!member && <Button className="w-full" variant="signal" onClick={() => { setMember(true); setRole("Member"); setMessage("Demo membership activated. No payment was taken."); }}>Try demo membership <ArrowRight className="size-4" /></Button>}
          {member && <Button className="w-full" variant="signal" disabled={reserved || !published} onClick={() => { setReserved(true); setMessage("Sample reservation confirmed. Switch to Organiser to see the registration."); }}>{reserved ? <><CheckCircle2 className="size-4" /> Reservation confirmed</> : published ? "Reserve my demo place" : "Registration paused"}</Button>}
          {reserved && <div className="mt-5 rounded-xl border border-accent/40 p-4"><p className="flex items-center gap-2 font-semibold"><Ticket className="size-4" /> Your sample ticket</p><p className="mt-2 text-sm text-muted-foreground">CX-DEMO-001 · Alex Novák<br />Annual Symposium · 1 member place</p><Button className="mt-4" variant="outline" size="sm" onClick={() => { setReserved(false); setMessage("Sample reservation cancelled. The organiser count has been updated."); }}>Cancel sample reservation</Button></div>}
        </section>
      </div> : <section className="rounded-2xl border border-border bg-card p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow text-accent">Organiser workspace · Simulation</p><h2 className="mt-3 text-3xl font-bold">A clear view of your community.</h2></div><Users className="size-9 text-accent" /></div>
        <div className="my-8 grid gap-4 sm:grid-cols-3">{[["Demo members", member ? "1" : "0"], ["Confirmed reservations", reserved ? "1" : "0"], ["Event visibility", published ? "Published" : "Draft"]].map(([label, value]) => <div key={label} className="rounded-xl bg-muted/40 p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-5"><div><h3 className="font-semibold">CometX Annual Symposium</h3><p className="mt-1 text-sm text-muted-foreground">Changing this sample status also changes booking availability in the member view.</p></div><Button variant="outline" onClick={() => { setPublished(!published); setMessage(published ? "Demo event moved to draft. New sample bookings are paused." : "Demo event published. Sample bookings are open."); }}>{published ? "Move to draft" : "Publish demo event"}</Button></div>
        <h3 className="mt-7 font-semibold">Registrations</h3>
        {reserved ? <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted/40 p-5"><div><p className="font-semibold">Alex Novák <span className="text-xs text-muted-foreground">· sample member</span></p><p className="mt-1 text-sm text-muted-foreground">CX-DEMO-001 · Member ticket · CHF 0</p></div><span className="flex items-center gap-2 text-sm text-accent"><CheckCircle2 className="size-4" /> Confirmed</span></div> : <p className="mt-4 text-muted-foreground">No sample reservations yet. Open the Member view, activate a demo membership and reserve a place.</p>}
      </section>}
      <div className="mt-8 grid gap-4 border-t border-border pt-6 text-sm md:grid-cols-3"><p><strong>1. Discover</strong><br /><span className="text-muted-foreground">Show the branded website and upcoming events.</span></p><p><strong>2. Experience</strong><br /><span className="text-muted-foreground">Activate demo membership and reserve a sample ticket.</span></p><p><strong>3. Manage</strong><br /><span className="text-muted-foreground">See the reservation and change event availability.</span></p></div>
    </div>
  );
}
