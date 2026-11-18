# External conference Stripe checkout test

Open this standalone page over localhost so the Stripe Buy Button can render:

~~~powershell
py -m http.server 4173 --bind 127.0.0.1 --directory docs/external-conference-test
~~~

Then visit <http://127.0.0.1:4173>.

Enter a test name and email, then use the generated Buy Button to open Stripe Checkout in test mode. Use Stripe's test card details; the page is wired to the existing CHF 10 Sandbox Payment Link.

The page demonstrates the browser integration only:

- It passes the attendee email through the customer-email attribute.
- It creates a demo REG-... reference for client-reference-id.
- It shows the attendee-specific element code.
- A repeated email is flagged only in the current browser tab.
- It does not save a real registration, receive webhooks, confirm payment, or unlock content. Those controls belong on the conference company's server.
- The attendee name remains with the conference registration. This Buy Button does not pass a name to Stripe. Disable **Collect full names** in the Payment Link if Checkout should not ask again.

Do not use this test button for real charges.
