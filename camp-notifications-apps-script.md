# Endgame Camp Notifications Apps Script

Use this version after creating `CAMP_SIGNUP_WEBHOOK_SECRET` in hosting.

```js
const SHEET_NAME = "Лист1";
const WEBHOOK_SECRET = "replace-with-the-same-secret-as-hosting";

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  if (!sheet) {
    return jsonResponse({ ok: false, message: "Sheet not found." });
  }

  let payload;

  try {
    payload = JSON.parse(e.postData.contents || "{}");
  } catch {
    return jsonResponse({ ok: false, message: "Invalid JSON." });
  }

  if (String(payload.secret || "") !== WEBHOOK_SECRET) {
    return jsonResponse({ ok: false, message: "Unauthorized." });
  }

  const email = String(payload.email || "").trim();
  const source = String(payload.source || "").trim();
  const consent = String(payload.consent || "").trim();
  const submittedAt = String(payload.submittedAt || new Date().toISOString()).trim();

  if (!email) {
    return jsonResponse({ ok: false, message: "Email is required." });
  }

  sheet.appendRow([email, source, consent, submittedAt]);

  return jsonResponse({ ok: true });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```
