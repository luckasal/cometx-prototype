# CometX Resend sender setup (20 October 2026)

Resend domain `mail.cometx.ch` was added in the signed-in Resend account with sending on and receiving off. Domain verification is pending. `cometx.ch` uses Wix nameservers (`ns6.wixdns.net`, `ns7.wixdns.net`), so these records belong in the Wix DNS zone. Do not change existing MX, SPF, or website records.

| Type | Host in `cometx.ch` zone | Value |
| --- | --- | --- |
| TXT | `resend._domainkey.mail` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDtxaf6lIUY0knhOwhjvS2kONYc8HkiWfhcaDEMfjbmZionUml1BpBYJr5fTzhRRyNzgRm89o+tLgxY5Q+0w8pEu3T7nv+VT46lDuC1ivjECD2ZrYnrZS/ZNg6bfnaJEGGm6+c7Q5GFplvVFOpXbeVJQZSiGQx6an35kZE2vuZgNQIDAQAB` |
| CNAME | `rsend.mail` | `rsend-euw1.forge.rmta.net` |
| CNAME | `send.mail` | `send.forge.rmta.net` |

Resend displays TTL `Auto` for all three records. Its domain record is [mail.cometx.ch](https://resend.com/domains/add/255c09ae-ecfb-4ae5-b4fb-d434574ac56e). After Wix DNS access is available, add the records and use Resend's **I've added the records** control. Confirm the domain is Verified before creating an API key restricted to **Sending access** and this domain only. Do not use the existing keys for other projects.

The CometX app already sends guest ticket confirmations through Resend after ticket issuance. Vercel Production currently has no `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, or `TICKET_EMAIL_MODE` variables. Keep ticket delivery disabled until the domain is verified, then add a domain-scoped API key as a server-only secret, set `RESEND_FROM_EMAIL` to an address on `mail.cometx.ch`, and set `TICKET_EMAIL_MODE=enabled`. Redeploy with Production settings and verify delivery using a designated test guest order. The newsletter admin page is a consented-contact view; it has no broadcast sending workflow yet.

Stripe remains test-only. The connected Stripe tool currently exposes only an unrelated *live* account, so it was not used for a CometX cancellation check. The cancellation date mapper has focused local coverage. End-to-end hosted cancellation still needs access to the CometX Stripe test account and a disposable subscription; do not cancel the current member subscription.
