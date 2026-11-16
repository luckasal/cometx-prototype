# Stripe invoices with Swiss QR-bills and bank-feed reconciliation

Stripe remains the invoice ledger. Stripe's standard invoice PDF cannot include the SIX Swiss QR-bill, so CometX appends a generated payment-slip page to Stripe's PDF and sends that combined PDF through the existing Resend mail service.

## Invoice flow

- Create an invoice in the Stripe Dashboard for a customer with a billing email.
- Use `Send invoice` collection (bank payment) and a CHF or EUR amount.
- Finalize the invoice. The `invoice.finalized` webhook asks CometX to generate and email the combined Stripe PDF + QR-bill.
- Do not use Stripe's separate “Send invoice” email action for that invoice; it would send Stripe's PDF without the QR-bill. Stripe still owns the invoice, its hosted page, amount and status.
- The QR-bill is only generated for invoices still open with a positive amount due. Already-settled Checkout, manual-transfer and membership invoices are excluded to avoid inviting a duplicate payment.

The SIX QR-bill needs CometX's legal creditor name, structured address, and its bank-issued IBAN or QR-IBAN. A normal IBAN uses a SCOR reference; a QR-IBAN uses a QRR reference. The server validates the IBAN and generated reference before sending.

## Bank-feed flow

The bank connector must be read-only and normalize booked incoming transactions to the signed request schema handled at `/api/public/bank-feed`. The endpoint stores a private, idempotent transaction record and reconciles only one exact match on QR reference, amount and currency. It marks the open Stripe invoice paid out of band. It never creates a PaymentIntent/Checkout payment or invokes ticket/member fulfillment. Unmatched, duplicate-reference and amount-mismatch rows remain unreconciled for review/retry.

This endpoint is the CometX side of the integration; it is not itself a bank connection. The connector/provider adapter must be chosen and configured after CometX identifies its bank and completes the provider's consent/onboarding steps. SIX bLink is one Swiss account-information route; its bank coverage and service-user onboarding must be confirmed for the specific account.

## Server configuration

- `COMETX_QR_CREDITOR_IBAN`
- `COMETX_QR_CREDITOR_NAME`
- `COMETX_QR_CREDITOR_STREET`
- `COMETX_QR_CREDITOR_BUILDING_NUMBER` (optional)
- `COMETX_QR_CREDITOR_POSTAL_CODE`
- `COMETX_QR_CREDITOR_CITY`
- `COMETX_QR_CREDITOR_COUNTRY` (defaults to `CH`)
- `BANK_FEED_PROVIDER`
- `BANK_FEED_ACCOUNT_ID` (opaque provider-side account identifier, not the IBAN)
- `BANK_FEED_WEBHOOK_SECRET` (at least 32 characters; server-side only)
- Existing `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` and `RESEND_FROM_EMAIL`

Stripe webhook delivery must include `invoice.finalized` and `invoice.paid`. The local migration `0038_swiss_qr_invoice_bank_feed.sql` must be applied before enabling the bank-feed route. Keep Stripe keys test-mode only until the separate live-mode release is approved and configured.
