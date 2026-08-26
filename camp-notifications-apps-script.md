# Endpoint для форм на Google Apps Script

Используйте этот вариант, если сайт размещен как статический сайт, например на GitHub Pages.

1. Создайте Google Sheet.
2. Добавьте две вкладки с названиями `CampNotifications` и `ContactMessages`.
3. Откройте `Extensions -> Apps Script`.
4. Вставьте туда этот скрипт.
5. Разверните его как Web App с доступом `Anyone`.
6. Скопируйте URL Web App и вставьте его в `FORM_ENDPOINTS` в файле `script.js`.

```js
const CAMP_SHEET_NAME = "CampNotifications";
const CONTACT_SHEET_NAME = "ContactMessages";
const NOTIFICATION_EMAIL = "your-email@example.com";

function doPost(e) {
  let payload;

  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (error) {
    return jsonResponse({ ok: false, message: "Invalid JSON." });
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

  if (!isEmail(email) || !consent) {
    return jsonResponse({ ok: false, message: "Email and consent are required." });
  }

  const sheet = getSheet(CAMP_SHEET_NAME);
  sheet.appendRow([
    new Date(),
    email,
    String(payload.source || "camps-page"),
    "endgame-camp-announcements",
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

В `script.js` можно использовать один и тот же URL развернутого Web App для обеих форм, если они обрабатываются этим одним скриптом:

```js
const FORM_ENDPOINTS = {
  contact: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
  campNotifications: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
};
```

Так как endpoint вызывается напрямую со статического сайта, не добавляйте приватные секреты в `script.js`.
