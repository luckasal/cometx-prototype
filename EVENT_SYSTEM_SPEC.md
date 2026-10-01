You own the complete CometX EVENT SYSTEM.

Read first:
- EVENT_ADMIN_GAPS.md
- AGENTS.md
- .ai/CONTEXT.md
- .ai/TASKS.md
- .ai/HANDOFF.md

Goal:
Finish the entire event lifecycle from CUSTOMER, ADMIN/ORGANISER and BACKEND perspectives.

Do NOT build everything in one run.
Treat this as the master specification and implement one small phase at a time.
After every phase: test minimally, update HANDOFF/GAPS, report, STOP.

==================================================
1. CUSTOMER EVENT DISCOVERY
==================================================

Customer can:
- browse upcoming events
- browse past/completed events
- filter/search events if appropriate
- open event detail
- see:
  - title
  - description
  - hero/gallery
  - date/time
  - venue/address
  - speakers
  - programme/workshops
  - partners
  - ticket availability
  - sale deadline
  - public/member pricing
  - sold-out/closed state

Event page must be useful for:
- guest
- logged-in non-member
- logged-in member

==================================================
2. CUSTOMER PRICING
==================================================

Guest:
- sees public price
- can buy without account

Logged-in non-member:
- sees public price
- optional membership CTA

Logged-in member:
- server determines active membership tier
- automatically applies correct benefit
- show regular price + member benefit + final price

Membership rules must use actual CometX plan rules.
Never trust client-calculated price.

==================================================
3. CART
==================================================

Normal ecommerce-style cart.

Cart may contain tickets from multiple events.

Show grouped by event:
- event
- date/location
- ticket type
- quantity
- unit price
- member discount
- line total
- event subtotal

Customer can:
- increase/decrease quantity
- remove ticket
- remove event

Show one cart total if using combined checkout.

Keep buyer separate from attendee.

==================================================
4. ATTENDEE DETAILS
==================================================

Every individual ticket can have its own attendee.

Example:
3 × Standard Ticket

Attendee 1
- first name
- last name

Attendee 2
- first name
- last name

Attendee 3
- first name
- last name

Buyer may be different from attendees.

Buyer fields:
- first name
- last name
- email

Do NOT require each attendee to create an account.

==================================================
5. CHECKOUT
==================================================

Customer checkout flow:

1. Contact details
2. Ticket + attendee details
3. Event policies / required consents
4. Order review
5. Payment

Show:
- event(s)
- ticket types
- quantities
- prices
- discounts/member benefits
- subtotal
- total

Do not expose technical/provider language.

If coupons/gift cards are supported later, integrate them cleanly.
Do not show fake “coming soon” placeholders.

==================================================
6. PAYMENT
==================================================

Stripe is hidden payment backend.

Backend must:
- re-fetch current event/ticket data
- revalidate event state
- sale window
- capacity
- membership
- benefit
- quantity
- final price

Never trust browser-provided final price.

Create Stripe Checkout Session server-side.

Successful payment:
- webhook confirms payment
- order becomes paid
- tickets are issued

Cancelled/failed payment:
- no confirmed paid tickets

Free/included tickets:
- skip Stripe where appropriate
- still create proper order/ticket records

==================================================
7. POST-PURCHASE CUSTOMER EXPERIENCE
==================================================

After purchase show:
- confirmation
- order reference
- event
- attendees
- purchased tickets

Logged-in buyer:
- tickets appear in My CometX

Guest:
- secure ticket access link
- confirmation email

Each issued ticket:
- unique ticket ID/code
- event
- ticket type
- attendee
- status
- optional QR/check-in code

My CometX must show only owned/confirmed tickets,
NOT cart/pending checkout items.

==================================================
8. ADMIN EVENT LIST
==================================================

Admin Events page should show:
- image
- event title
- lifecycle status
- publish status
- date
- venue
- capacity
- tickets sold
- revenue
- last modified

Support:
- search
- filters
- create event
- duplicate
- preview
- publish/unpublish
- cancel
- delete

==================================================
9. ADMIN EVENT WORKSPACE
==================================================

One event should have a proper admin workspace/tabs:

Overview
Tickets
Settings
Orders
Guests
Emails
Promotion
Analytics

==================================================
10. ADMIN OVERVIEW
==================================================

Show:
- event status
- publish state
- public/preview link
- date/time
- venue
- capacity
- sold tickets
- revenue
- recent orders
- registration state
- setup completeness/issues

==================================================
11. ADMIN TICKETS
==================================================

Admin manages:
- multiple ticket types
- public price
- member price/benefit
- plan-specific entitlement
- capacity
- sold count
- sale start/end
- active/inactive
- archive/unarchive
- free ticket
- early-bird structure if supported
- quantity/order limits

Stripe sync happens automatically behind the scenes.
Do not require admin to open Stripe.

==================================================
12. ADMIN SETTINGS
==================================================

Per-event settings:
- registration open/close
- event capacity
- max tickets/order
- buyer fields
- attendee fields
- event policies/consents
- confirmation message
- cancellation/refund policy display
- waitlist if later supported

==================================================
13. ADMIN ORDERS
==================================================

Per-event Orders:
- search
- filters
- buyer
- guest/member status
- ticket types
- attendees
- quantity
- discounts
- total
- payment status
- order status
- creation date

Order detail:
- payment
- attendees
- tickets
- ticket IDs
- resend ticket/email
- refund/cancellation actions when safely implemented

==================================================
14. ADMIN GUESTS / ATTENDEES
==================================================

Dedicated attendee roster:
- attendee name
- buyer/contact
- email if appropriate
- ticket type
- member/guest context
- check-in state
- ticket status

Support:
- search/filter
- check-in / undo check-in
- CSV export
- manual attendee/ticket if intentionally supported

==================================================
15. ADMIN EMAILS
==================================================

Per-event communication controls:

- purchase confirmation
- reminder
- event update
- cancellation
- post-event email

Admin can:
- enable/disable
- edit subject/content where supported
- see delivery state/errors at useful level

Use Resend behind the scenes.
Do not expose Resend internals in normal UI.

==================================================
16. PROMOTION
==================================================

Support:
- public event URL
- share actions
- coupons/discounts
- newsletter campaign connection
- membership promotion
- partner/sponsor links
- GA4 campaign/conversion tracking

==================================================
17. EVENT ANALYTICS
==================================================

Per event show:
- page views
- ticket selections
- add to cart
- checkout starts
- purchases
- conversion rate
- tickets sold
- orders
- revenue
- ticket-type breakdown
- member vs public purchases
- capacity progress
- sales over time

Use:
- Supabase for business/payment data
- GA4 for traffic/funnel data

Do not invent metrics if GA4 reporting credentials are unavailable.

==================================================
18. BACKEND / DATA MODEL
==================================================

Keep clean separation:

- event
- ticket_type
- contact
- member/profile
- buyer
- attendee
- order
- order_line
- payment
- issued_ticket

Supabase = source of truth
Stripe = payment processor
Resend = email provider
GA4 = traffic analytics

No Lovable dependencies.

==================================================
19. DATA SAFETY
==================================================

Required:
- transactional event save where possible
- no partial event/ticket/workshop writes
- idempotent Stripe webhook
- capacity race-condition protection
- server-side pricing
- membership validation
- safe migrations
- admin authorization
- no provider secrets client-side

==================================================
20. EVENT LIFECYCLE
==================================================

Support clearly:

Draft
-> Preview
-> Published
-> Registration open
-> Registration closed / Sold out
-> Completed

Also:
-> Unpublished
-> Cancelled

Keep publish_state separate from operational event_status.

==================================================
IMPLEMENTATION PROCESS
==================================================

Do NOT implement all of this now.

Use EVENT_ADMIN_GAPS.md to mark:
- DONE
- PARTIAL
- MISSING
- RELEASE BLOCKER

Work one phase at a time.

For every phase:
1. state exact scope
2. implement only that scope
3. run minimal relevant checks
4. update EVENT_ADMIN_GAPS.md
5. update .ai/TASKS.md + .ai/HANDOFF.md
6. report files changed + remaining gaps
7. STOP

Start with the next highest-priority unfinished EVENT ADMIN phase from EVENT_ADMIN_GAPS.md.
Do not start a second phase automatically.