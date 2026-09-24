# CometX prototype roadmap

- [ ] Database migrations (profiles, roles, plans, entitlements, memberships, events, speakers, workshops, ticket types, registrations, articles, partners) + RLS + grants
- [ ] Seed data (3 plans, 3 events, 6 speakers, 3 workshops, 4 ticket types, 5 partners, 4 articles)
- [ ] Design system matching cometx.ch (dark + lime #D6DD28)
- [ ] Auth: /login, /register, /account redirect, email auth enabled
- [ ] Server helpers: hasEntitlement, getEntitlementValue, getCurrentMembership, getEventPriceForUser
- [ ] Public site: /, /events, /events/[slug], /membership, /community, /community/articles/[slug], /partners, /about
- [ ] Registration flow (free reserve + capacity/duplicate checks)
- [ ] Stripe test checkout + webhook (needs STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
- [ ] Account area: /account, /account/events, /account/membership, /account/profile
- [ ] Gated content
- [ ] Admin: dashboard + CRUD for events, speakers, articles, plans; lists for registrations, members
- [ ] Storage buckets for images
- [ ] Tests for pricing/entitlements/capacity/duplicates
- [ ] Docs: README, DEPLOYMENT.md, PRODUCTION_PLAN.md, .env.example

- [ ] Match cometx.ch design closely: exact colors, fonts, and imagery/logo
- [ ] Replace prototype content with all current public information from cometx.ch; include featured history only
