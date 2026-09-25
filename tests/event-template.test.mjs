import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Render the real template with only routing/theme wrappers stubbed. No DB writes.
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const reactUrl = import.meta.resolve("react");
const wrapper = (name, tag) =>
  moduleUrl(
    `import React from ${JSON.stringify(reactUrl)}; export const ${name}=({children,asChild,...props})=>asChild?children:React.createElement('${tag}',props,children);`,
  );
const imports = {
  "@tanstack/react-router": wrapper("Link", "a"),
  "lucide-react": import.meta.resolve("lucide-react"),
  "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
  "@/lib/event-content": new URL("../src/lib/event-content.ts", import.meta.url).href,
  "@/lib/pricing": new URL("../src/lib/pricing.ts", import.meta.url).href,
  "@/contexts/LanguageContext": moduleUrl('export const useLanguage=()=>({language:"en"});'),
  "./BrandXElement": wrapper("BrandXElement", "span"),
  "@/components/ui/button": wrapper("Button", "button"),
  "./Bits": wrapper("StatusPill", "span"),
};
let code = ts.transpileModule(
  await readFile(
    new URL("../src/components/site/EventDetailTemplate.tsx", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
for (const [specifier, url] of Object.entries(imports))
  code = code.replaceAll(JSON.stringify(specifier), JSON.stringify(url));
const { EventDetailTemplate } = await import(moduleUrl(code));
const base = {
  event: {
    id: "event",
    title: "Test event",
    slug: "test-event",
    eventType: "workshop",
    shortDescription: null,
    description: null,
    heroImageUrl: null,
    galleryUrls: [],
    startDate: "2099-10-17T10:00:00Z",
    endDate: null,
    venue: null,
    address: null,
    capacity: null,
    status: "registration_open",
    featured: false,
    registrationStart: null,
    registrationEnd: null,
    publishState: "published",
  },
  speakers: [],
  workshops: [],
  partners: [],
  tickets: [],
  registrationOpen: true,
  isPreview: false,
  spotsLeft: null,
  membershipName: null,
  isSignedIn: false,
  myRegistration: null,
};
const ticket = {
  id: "ticket",
  name: "Standard",
  description: null,
  price: {
    eligible: true,
    basePrice: 100,
    finalPrice: 80,
    currency: "CHF",
    discount: 20,
    includedInMembership: false,
  },
  spotsLeft: 4,
  soldOut: false,
  hasMemberPricing: true,
};
const render = (data) =>
  renderToStaticMarkup(
    React.createElement(EventDetailTemplate, {
      data,
      pending: false,
      onReserve: () => {},
      onLogin: () => {},
    }),
  );

test("absent optional data stays hidden; no invented speakers or prices", () => {
  const html = render(base);
  assert.match(html, /No tickets are available yet/);
  assert.doesNotMatch(html, /Meet the speakers|Programme|About this event|Regular price/);
});
test("ticket card renders all ticket types and server-calculated member price", () => {
  const html = render({
    ...base,
    isSignedIn: true,
    membershipName: "Test membership",
    tickets: [ticket, { ...ticket, id: "second", name: "Second option" }],
  });
  assert.match(html, /Standard/);
  assert.match(html, /Second option/);
  assert.match(html, /CHF 100/);
  assert.match(html, /CHF 80/);
  assert.match(html, /Your member price/);
  assert.match(html, /Reserve your place/);
});
test("preview and sold-out tickets cannot offer registration", () => {
  const preview = render({ ...base, isPreview: true, tickets: [ticket] });
  assert.match(preview, /Booking disabled in preview/);
  assert.doesNotMatch(preview, /Log in to register|Reserve your place/);
  const sold = render({ ...base, tickets: [{ ...ticket, soldOut: true, spotsLeft: 0 }] });
  assert.match(sold, /Sold out/);
  assert.doesNotMatch(sold, /Log in to register|Reserve your place/);
});
test("structured content and full speaker bio render as escaped text", () => {
  const html = render({
    ...base,
    event: { ...base.event, description: "## What to expect\n<script>bad()</script>" },
    speakers: [
      {
        id: "s",
        name: "Test speaker",
        photoUrl: "/test.jpg",
        jobTitle: "Role",
        company: "Company",
        bio: "Full speaker biography.",
      },
    ],
  });
  assert.match(html, /What to expect/);
  assert.match(html, /Full speaker biography/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>bad/);
});
