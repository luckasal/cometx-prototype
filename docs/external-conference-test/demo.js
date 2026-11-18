const BUY_BUTTON_ID = "buy_btn_1Ud6vR0A7SoM9pRta8GIbGuQ";
const PUBLISHABLE_KEY = "pk_test_51UJVUI0A7SoM9pRtpi50x4V4cRd9DMzlHrvVnBXxQpm4MKfKUoxFiYpceA6BoMy81NPQcAhsE4Jlpyix7352rdbW00kX3XLX7H";
const usedEmails = new Set(); // Demo-only. Production uniqueness must be enforced in the conference database.

const form = document.querySelector("#registration-form");
const message = document.querySelector("#message");
const buttonZone = document.querySelector("#button-zone");
const codePreview = document.querySelector("#code-preview");
const statusDot = document.querySelector("#status-dot");
const statusTitle = document.querySelector("#status-title");
const statusText = document.querySelector("#status-text");
let activeCode = "";

document.querySelector("#script-warning")?.remove();

// The previous no-JavaScript form submit appended attendee data to the URL.
// Restore it into the form, then remove it from browser history/address bar.
const query = new URLSearchParams(window.location.search);
if (query.has("fullName")) form.elements.fullName.value = query.get("fullName");
if (query.has("email")) form.elements.email.value = query.get("email");
if (window.location.search) {
  window.history.replaceState(null, "", window.location.pathname + window.location.hash);
}

function showMessage(text, kind) {
  message.textContent = text;
  message.className = "message " + kind;
}

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function waitForStripeButton() {
  if (customElements.get("stripe-buy-button")) return Promise.resolve(true);
  return Promise.race([
    customElements.whenDefined("stripe-buy-button").then(() => true),
    new Promise((resolve) => window.setTimeout(() => resolve(false), 10000)),
  ]);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const attendeeName = form.elements.fullName.value.trim();
  const email = form.elements.email.value.trim().toLowerCase();

  if (!attendeeName || !email) {
    showMessage("Enter the name and email saved on the conference registration.", "error");
    return;
  }
  if (usedEmails.has(email)) {
    showMessage("This email already has a registration in this demo tab. Production must check this on its server before opening checkout.", "error");
    return;
  }

  showMessage("Loading Stripe’s test checkout button…", "success");
  if (!(await waitForStripeButton())) {
    showMessage("Stripe’s button script did not load. Check your connection and refresh the page.", "error");
    return;
  }

  usedEmails.add(email);
  const registrationId = "REG-" + crypto.randomUUID();
  const escapedEmail = escapeAttribute(email);
  const escapedRegistrationId = escapeAttribute(registrationId);
  const buttonMarkup = '<script async src="https://js.stripe.com/v3/buy-button.js"></script>\n\n<stripe-buy-button\n  buy-button-id="' + BUY_BUTTON_ID + '"\n  publishable-key="' + PUBLISHABLE_KEY + '"\n  customer-email="' + escapedEmail + '"\n  client-reference-id="' + escapedRegistrationId + '"\n></stripe-buy-button>';
  activeCode = buttonMarkup;

  const stripeButton = document.createElement("stripe-buy-button");
  stripeButton.setAttribute("buy-button-id", BUY_BUTTON_ID);
  stripeButton.setAttribute("publishable-key", PUBLISHABLE_KEY);
  stripeButton.setAttribute("customer-email", email);
  stripeButton.setAttribute("client-reference-id", registrationId);
  buttonZone.replaceChildren(stripeButton);
  codePreview.textContent = buttonMarkup;

  statusDot.style.background = "#d28a08";
  statusTitle.textContent = "Details ready · awaiting payment";
  statusText.textContent = attendeeName + " · " + email + " · " + registrationId + ". These values are held in this browser tab only. The demo has no registration database or webhook endpoint, so it cannot confirm payment or unlock conference content.";
  showMessage("Registration details are ready. The Stripe test button now uses this email and reference.", "success");
});

document.querySelector("#copy-code").addEventListener("click", async (event) => {
  if (!activeCode) {
    showMessage("Submit the registration form first to generate attendee-specific button code.", "error");
    return;
  }
  const copyButton = event.currentTarget;
  try {
    await navigator.clipboard.writeText(activeCode);
    copyButton.textContent = "Copied";
    window.setTimeout(() => { copyButton.textContent = "Copy code"; }, 1500);
  } catch {
    showMessage("Clipboard access is unavailable. Select and copy the code shown above.", "error");
  }
});
