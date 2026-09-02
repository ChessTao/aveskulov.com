# Google Apps Script endpoint for site forms

Use this when the site sends form submissions through the server endpoint:

- `/api/contact`
- `/api/camp-notifications`

The site server forwards both form types to Google Apps Script using
`CAMP_SIGNUP_WEBHOOK_URL` and `CAMP_SIGNUP_WEBHOOK_SECRET`.

## Setup

1. Create a Google Sheet.
2. Add two sheets named `CampNotifications` and `ContactMessages`.
3. Open `Extensions -> Apps Script`.
4. Paste the script below.
5. Replace `your-email@example.com` with the email address that should receive notifications.
6. Replace `replace-with-a-long-random-secret` with the same value used for `CAMP_SIGNUP_WEBHOOK_SECRET`.
7. Deploy as `Web app`.
8. Set access to `Anyone`.
9. Copy the deployment URL into `CAMP_SIGNUP_WEBHOOK_URL`.

```js
const CAMP_SHEET_NAME = "CampNotifications";
const CONTACT_SHEET_NAME = "ContactMessages";
const NOTIFICATION_EMAIL = "your-email@example.com";
const WEBHOOK_SECRET = "replace-with-a-long-random-secret";

function doPost(e) {
  let payload;

  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (error) {
    return jsonResponse({ ok: false, message: "Invalid JSON." });
  }

  if (String(payload.secret || "") !== WEBHOOK_SECRET) {
    return jsonResponse({ ok: false, message: "Unauthorized." });
  }

  if (String(payload.website || "").trim()) {
    return jsonResponse({ ok: true });
  }

  if (payload.type === "camp-notification") {
    return handleCampNotification(payload);
  }

  if (payload.type === "contact-message") {
    return handleContactMessage(payload);
  }

  return jsonResponse({ ok: false, message: "Unknown form type." });
}

function handleCampNotification(payload) {
  const email = String(payload.email || "").trim();
  const consent = payload.consent === true;
  const consentLabel = String(payload.consentLabel || "endgame-camp-announcements").trim();

  if (!isEmail(email) || !consent) {
    return jsonResponse({ ok: false, message: "Email and consent are required." });
  }

  const sheet = getSheet(CAMP_SHEET_NAME);
  sheet.appendRow([
    new Date(),
    email,
    String(payload.source || "camps-page"),
    consentLabel,
  ]);

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: "New endgame camp notification request",
    body: `Please add this email to the endgame camp notification list:\n\n${email}`,
  });

  return jsonResponse({ ok: true });
}

function handleContactMessage(payload) {
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim();
  const level = String(payload.level || "").trim();
  const message = String(payload.message || "").trim();

  if (!isEmail(email) || !message) {
    return jsonResponse({ ok: false, message: "Email and message are required." });
  }

  const sheet = getSheet(CONTACT_SHEET_NAME);
  sheet.appendRow([
    new Date(),
    name,
    email,
    level,
    message,
    String(payload.source || "contact-page"),
  ]);

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    replyTo: email,
    subject: "New chess coaching inquiry",
    body: [
      `Name: ${name || "A prospective student"}`,
      `Email: ${email}`,
      `Level: ${level || "not specified"}`,
      "",
      message,
    ].join("\n"),
  });

  return jsonResponse({ ok: true });
}

function getSheet(name) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(name);

  if (sheet) {
    return sheet;
  }

  return spreadsheet.insertSheet(name);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```
