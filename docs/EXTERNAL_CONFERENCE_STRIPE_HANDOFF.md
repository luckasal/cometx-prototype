# CometX Stripe checkout for the external conference website

**Prepared for the meeting with the Czech conference company.** This brief describes a direct Stripe-to-conference-site flow. The CometX website is not part of checkout or access control.

## Proposed flow

1. The conference site creates a pending registration and a unique, opaque registration ID before showing checkout.
2. CometX creates a one-time Stripe Payment Link in the CometX Stripe account and generates its embedded Buy Button. The Czech company embeds the button on its registration page.
3. The page passes the registration ID as `client-reference-id` and the already-entered email as `customer-email`. Stripe Checkout hosts the payment step; customers do not need to re-enter their registration email.
4. Stripe sends payment events directly to the Czech company's production backend endpoint.
5. That backend verifies the Stripe signature, matches the event to the pending registration, confirms the correct amount/currency and successful payment, then marks the registration paid and unlocks conference access. Processing must be idempotent so Stripe retries cannot grant access twice.

Stripe's Buy Button supports one-time Payment Links, `client-reference-id`, and `customer-email`. The email passed as `customer-email` is prefilled and locked in Checkout; attendees who need to correct it should do so on the conference registration page first. Stripe documents that `client-reference-id` is returned in `checkout.session.completed`. [Buy Button documentation](https://docs.stripe.com/payment-links/buy-button)

## Safe embed template

Stripe will generate the actual button code after CometX creates the live Payment Link. The Czech developer fills the two attendee-specific values from the registration already stored on their site:

```html
<script async src="https://js.stripe.com/v3/buy-button.js"></script>
<stripe-buy-button
  buy-button-id="{{COMETX_LIVE_BUY_BUTTON_ID}}"
  publishable-key="{{COMETX_LIVE_PUBLISHABLE_KEY}}"
  client-reference-id="{{PENDING_REGISTRATION_ID}}"
  customer-email="{{REGISTRATION_EMAIL}}"
></stripe-buy-button>
```

The publishable key and button ID are intended for the page. **Never put a Stripe secret API key or webhook signing secret in HTML, JavaScript bundles, or browser storage.** Keep the registration ID opaque and free of personal data. The conference backend must look it up and verify it is an eligible pending registration; it must not unlock content just because a browser supplied an ID.

## Webhook contract for the Czech developer

Ask the company to provide a stable HTTPS production endpoint URL and confirm that it can:

- Verify Stripe's `Stripe-Signature` using the endpoint-specific `whsec_...` value and the unmodified raw request body, with a supported Stripe server SDK.
- Process `checkout.session.completed` only when the payment is actually paid, and `checkout.session.async_payment_succeeded` for any delayed payment method enabled in Checkout. Keep access locked on `checkout.session.async_payment_failed`.
- Validate the expected live/test mode, CometX Payment Link or line item, amount, currency, and pending registration ID before granting access.
- Store processed Stripe event IDs and make fulfillment idempotent.
- Return a 2xx response after durable handling, and keep the registration locked if payment is unpaid, mismatched, failed, or cannot be matched.

The success/return page is for the attendee's experience only; it is not proof of payment. Stripe recommends server-side fulfillment from webhooks. [Stripe fulfillment guidance](https://docs.stripe.com/checkout/fulfillment)

The signing secret is not a Stripe API key and cannot create payments or access the CometX Dashboard, but it is still sensitive: CometX should send it to the company's server owner through an approved secure channel, and the company should store it server-side only. No Stripe Dashboard login or `sk_live_...` key is needed by the company.

## Decisions to settle in the meeting

1. **Offer and price:** public ticket name/description, final amount, currency, quantity rules, and whether there are multiple ticket options. These values must be confirmed before a live Payment Link can be created.
2. **Who is merchant of record / where money goes:** confirm the charge is made on CometX's Stripe account and proceeds settle to CometX. Any revenue share to the Czech company is a separate decision and is not included in this Buy Button setup.
3. **Registration and email:** confirm the Czech site generates the registration ID before checkout, can supply it and the attendee email to the button, and can correct email on its own registration form before opening Checkout.
4. **Webhook endpoint:** get the production HTTPS URL, endpoint owner/contact, and confirmation they can safely store the signing secret. Ask for a staging/test endpoint too so the integration can be verified without real charges.
5. **Access rules:** confirm exactly which content unlocks after payment, whether access is per registration/email, and how the company wants refunds or disputes to affect access.
6. **Confirmation and customer emails:** agree the post-checkout return URL and whether Stripe receipt emails or the conference company's own confirmation email is authoritative. Ask whether a legal invoice is required for each purchase; a Stripe receipt and a tax invoice are not automatically the same thing.

## CometX-side setup after the meeting

- Create the confirmed one-time product/price and Payment Link in Stripe **Live mode**; generate the Buy Button embed. Keep the CometX prototype's existing test configuration unchanged.
- In Stripe Live mode, register the Czech company's production URL for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`.
- Securely deliver the endpoint signing secret to the endpoint owner. Share only the generated embed snippet, which includes the public publishable key and Buy Button ID, with the website implementer.
- First verify the callback on their staging endpoint with a Stripe test-mode Payment Link and test webhook secret if the company provides staging. Only after the owner approves the price, endpoint, and live checkout should the Live Payment Link be activated for customers.

## Local test page

A standalone localhost demo is available in `docs/external-conference-test/`. Run it using the instructions in its README. It uses the existing CHF 10 test Buy Button and demonstrates passing the current registration email with `customer-email` and a demo reference with `client-reference-id`. Its reference and duplicate check are browser-only illustrations; it has no registration database, webhook endpoint, payment confirmation, or access unlock. The production site must create/store registration IDs and enforce email uniqueness on its server.

The Buy Button can prefill email but does not prefill the attendee name. To avoid asking for the name twice, the Payment Link's **Collect full names** option must be off. The conference site remains responsible for retaining the name.

## Not configured yet

No Live Payment Link, Buy Button, or external webhook destination has been created. The price/currency and the Czech company's endpoint are not yet known. This repository's CometX application remains test-only; this external integration would be configured separately in the CometX Stripe Dashboard and the Czech company's backend. No credentials are included in this document.
