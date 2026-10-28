# Payments: bank-transfer record and invoice-on-request scope

Prepared 28 October 2026 from the two Payments backlog rows and the supplied examples. PAY-02/PAY-03 first version is implemented locally. Production schema is applied; application release and hosted acceptance are tracked in `.ai/TASKS.md`.

Decisions confirmed 28 October: **finance verifies bank transfers**, **Stripe Invoicing issues legal invoices**, and online ticket buyers request an invoice **during checkout**. CometX records the request and finance attaches the issued Stripe invoice link.

## Current CometX behavior

- Stripe payment rows remain in the existing `/admin/payments` Stripe section.
- The current `payments` model includes Stripe identifiers and links to a user, registration or membership. Manual transfers use a separate model so they cannot be mistaken for online payments or trigger payment fulfillment.
- Ticket checkout now captures optional invoice requests. Finance creates legal invoices in Stripe Invoicing; authorized staff store the invoice reference/document URL in CometX.

## PAY-02: partner bank transfer

Proposed workflow: the person responsible for bank reconciliation confirms the money arrived in the bank or accounting system. An authorized Back Office user then records a **Bank transfer** against an existing partner organization, with an optional event or order reference. CometX displays the record for staff lookup. Stripe need not know about the transfer.

Smallest useful record: partner, amount, currency, paid date, reference, status, optional external invoice ID, optional note, and recorded-by/recorded-at audit fields. The supplied example is CHF 2,000 paid on 28 October 2026, reference “Partner ABC / Symposium,” status Paid. Store money in minor units and show the formatted amount. Do not copy the example into Production as a real payment.

Admin action: **Record bank transfer** in Payments with a partner selector, required amount/currency/paid date/reference, optional event/order text reference, optional invoice ID/note, and an explicit confirmation that finance checked the transfer against the bank or accounting system. Show it in Payments as “Bank transfer” with linked partner, status, paid date, recorder and audit times. Correct a mistake by voiding with a reason and recording a replacement; never silently delete or turn the record into a Stripe payment. Recording alone does not issue tickets, activate a membership, or mark a Stripe order paid.

Implementation boundary: authorized admins enter only finance-confirmed Paid transfers against partners. A mistaken record is voided with a reason; it is never deleted. The bank/accounting source used by finance remains outside CometX. Applying a partner transfer to an event order is not supported by this first version because its fulfillment policy has not been defined.

## PAY-03: invoice on request

Proposed workflow: CometX captures a request and billing details, while Stripe Invoicing or the existing accounting system issues the legal invoice. CometX stores only the request state and the resulting Stripe/external invoice ID and document URL.

Request fields: `invoice_requested`, billing name or company, billing address, optional VAT/UID, and optional note. Follow-up fields: independent `invoice_status`, Stripe invoice ID or external invoice ID, HTTPS invoice/document URL, and editor/time metadata. Show requests and status to invoice-managing admins and provide the document link when available. Do not generate an invoice PDF in CometX.

Implementation boundary: ticket buyers can request an invoice in checkout. Admins can capture a partner invoice request with the transfer or later. Finance creates the invoice in Stripe Invoicing and an admin records the Stripe ID and hosted URL; the UI also accepts an external invoice ID/document URL for an external issuer if needed later. CometX never generates the legal invoice. Country-specific invoice requirements and tax treatment stay with Stripe; CometX only stores the optional UID as text.

## Acceptance boundary

Keep bank-transfer records visibly distinct from Stripe payments and never let their entry trigger Stripe webhook fulfillment. Keep invoice request status distinct from payment status. The tables are private to server-side handlers, and the Production migration created no payment records. Local app code still needs deployment and hosted workflow acceptance.
