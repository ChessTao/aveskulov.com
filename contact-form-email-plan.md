# Contact Form Email Plan

## Goal

Make the `Send message` button on the Contact page send form submissions reliably, instead of only opening the visitor's email app through `mailto:`.

## Current State

- The Contact page form is in `index.html`.
- The button text is `Send message`.
- The current frontend logic in `script.js` collects `name`, `email`, `level`, and `message`.
- It then opens a prepared email through `mailto:`.
- No message is currently sent by the site backend.

## Recommended Approach

Use an email API provider, preferably Resend or Brevo.

This gives the cleanest user experience:

- the visitor fills in the form;
- clicks `Send message`;
- the site sends the message through `/api/contact`;
- the visitor sees a success or error message on the page;
- the message arrives directly in the site owner's email inbox.

## Required External Setup

Choose an email provider and prepare:

- API key;
- verified sender email or verified domain;
- recipient email address;
- any required DNS records, such as SPF/DKIM, if the provider requires domain verification.

Suggested runtime environment variables:

- `CONTACT_EMAIL_API_KEY`
- `CONTACT_EMAIL_TO`
- `CONTACT_EMAIL_FROM`

Exact variable names can be adjusted once the provider is chosen.

## Implementation Steps

1. Add a `/api/contact` handler to `build-static.mjs`, similar to the existing `/api/camp-notifications` endpoint.
2. Validate the submitted form data on the server:
   - required valid email;
   - non-empty message;
   - optional name and chess level;
   - honeypot field for simple bot protection.
3. Send the message through the selected email provider API.
4. Update `script.js` so the Contact form submits to `/api/contact` with `fetch`.
5. Show clear form states:
   - sending;
   - success;
   - validation error;
   - delivery error.
6. Keep `mailto:` only as a fallback if the backend is unavailable.
7. Add a short privacy-conscious note near the form if needed.
8. Rebuild with `npm.cmd run build`.
9. Test:
   - valid submission;
   - invalid email;
   - empty required fields;
   - provider/API failure;
   - production environment variables.

## Alternative Fast Setup

Use a form/webhook service such as Formspree, Basin, Getform, Make, Zapier, or Google Apps Script.

This requires fewer backend details:

- create a form endpoint/webhook;
- store it in `CONTACT_FORM_WEBHOOK_URL`;
- `/api/contact` forwards the form data there;
- the external service sends or stores the message.

This is faster, but less controlled than a direct email API.

## Recommended Next Decision

Choose between:

- **Resend/Brevo** for professional direct email delivery;
- **Formspree/Make/Zapier/Google Apps Script** for the fastest setup.

After that, the code changes are straightforward.
