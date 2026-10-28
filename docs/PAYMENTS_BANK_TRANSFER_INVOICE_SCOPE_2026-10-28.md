# Payments: bank-transfer record and invoice-on-request scope

Prepared 28 October 2026 from the two Payments backlog rows and the supplied examples. This is a workflow proposal, not an implemented payment or invoice feature.

## Current CometX behavior

- Back Office `/admin/payments` only lists existing payment rows with amount, status, document link and creation date. There is no manual entry action.
- The current `payments` model includes Stripe identifiers and links to a user, registration or membership. Reusing it for a partner bank transfer could make a manually recorded transfer look like an online payment. Keep the new record separate from Stripe checkout, webhook and ticket fulfillment.
- CometX does not currently collect invoice requests or billing details through a defined invoice-on-request flow.

## PAY-01: partner bank transfer

Proposed workflow: the person responsible for bank reconciliation confirms the money arrived in the bank or accounting system. An authorized Back Office user then records a **Bank transfer** against an existing partner organization, with an optional event or order reference. CometX displays the record for staff lookup. Stripe need not know about the transfer.

Smallest useful record: partner, amount, currency, paid date, reference, status, optional external invoice ID, optional note, and recorded-by/recorded-at audit fields. The supplied example is CHF 2,000 paid on 28 October 2026, reference “Partner ABC / Symposium,” status Paid. Store money in minor units and show the formatted amount. Do not copy the example into Production as a real payment.

Smallest admin action: **Record bank transfer** in Payments with a partner selector, required amount/currency/paid date/reference, and an explicit confirmation that the transfer was checked against the bank or accounting system. Show it in Payments as “Bank transfer” with the linked partner, status and recorder. Allow correction with an audit trail; do not silently delete or turn the record into a Stripe payment. Recording alone must not issue tickets, activate a membership, or mark a Stripe order paid.

Before implementation, confirm: who checks and records transfers; which banking/accounting system is authoritative; whether a transfer can pay an event order or only a partner obligation; whether staff need a pending state or should record only confirmed Paid transfers; and who may correct or reverse a mistaken entry.

## PAY-02: invoice on request

Proposed workflow: CometX captures a request and billing details, while Stripe Invoicing or the existing accounting system issues the legal invoice. CometX stores only the request state and the resulting Stripe/external invoice ID and document URL.

Request fields: `invoice_requested`, billing name or company, billing address, optional VAT/UID, and an optional note. Follow-up fields: `invoice_status`, Stripe invoice ID or external invoice ID, and an invoice URL. Show the request and status to staff and provide the document link when available. Do not generate an invoice PDF in CometX.

Before implementation, confirm: the actual invoice issuer/tool; which fields that tool requires for the relevant countries; whether online ticket buyers request an invoice during checkout or later; whether partner bank transfers use a separate accounting invoice flow; and which staff role can mark a request fulfilled. Do not infer tax or legal invoice rules from the example.

## Acceptance boundary

Keep bank-transfer records visibly distinct from Stripe payments and never let their entry trigger Stripe webhook fulfillment. Keep invoice request status distinct from payment status. Build PAY-01 and PAY-02 only after the owner and authoritative accounting workflow are confirmed; no schema or Production data changes are part of this preparation.
