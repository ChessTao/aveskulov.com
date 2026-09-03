export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (isApiPath(url.pathname) && request.method === "OPTIONS") {
      return withCors(request, new Response(null, { status: 204 }));
    }

    if (url.pathname === "/api/camp-notifications" && request.method === "POST") {
      let payload;

      try {
        payload = await request.json();
      } catch {
        return apiResponse(request, { message: "Invalid request." }, { status: 400 });
      }

      const email = String(payload.email || "").trim();
      const consent = payload.consent === true;
      const website = String(payload.website || "").trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (website) {
        return apiResponse(request, { message: "Accepted." }, { status: 202 });
      }

      if (!isEmail || !consent) {
        return apiResponse(request, { message: "Email and consent are required." }, { status: 400 });
      }

      const signup = {
        type: "camp-notification",
        email,
        source: payload.source || "camps-page",
        consent: true,
        consentLabel: "endgame-camp-announcements",
        submittedAt: new Date().toISOString(),
        secret: env.CAMP_SIGNUP_WEBHOOK_SECRET || "",
      };

      const result = await sendWebhook(env, signup);
      if (result) {
        return withCors(request, result);
      }

      return apiResponse(request, { message: "Accepted." }, { status: 202 });
    }

    if (url.pathname === "/api/contact" && request.method === "POST") {
      let payload;

      try {
        payload = await request.json();
      } catch {
        return apiResponse(request, { message: "Invalid request." }, { status: 400 });
      }

      const name = String(payload.name || "").trim();
      const email = String(payload.email || "").trim();
      const level = String(payload.level || "").trim();
      const message = String(payload.message || "").trim();
      const website = String(payload.website || "").trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (website) {
        return apiResponse(request, { message: "Accepted." }, { status: 202 });
      }

      if (!isEmail || !message) {
        return apiResponse(request, { message: "Email and message are required." }, { status: 400 });
      }

      const contactMessage = {
        type: "contact-message",
        name,
        email,
        level,
        message,
        source: payload.source || "contact-page",
        submittedAt: new Date().toISOString(),
        secret: env.CAMP_SIGNUP_WEBHOOK_SECRET || "",
      };

      const result = await sendWebhook(env, contactMessage);
      if (result) {
        return withCors(request, result);
      }

      return apiResponse(request, { message: "Accepted." }, { status: 202 });
    }

    return serveAsset(request, env);
  },
};

const ALLOWED_FORM_ORIGINS = new Set([
  "https://aveskulov.com",
  "https://www.aveskulov.com",
  "https://aveskulov-chess-coaching.vdaveskulov.chatgpt.site",
]);

function isApiPath(pathname) {
  return pathname === "/api/contact" || pathname === "/api/camp-notifications";
}

function apiResponse(request, body, init) {
  return withCors(request, Response.json(body, init));
}

function withCors(request, response) {
  const origin = request.headers.get("Origin");

  if (!origin || !ALLOWED_FORM_ORIGINS.has(origin)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.append("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function serveAsset(request, env) {
  const response = await env.ASSETS.fetch(request);

  if (response.status !== 404 || !["GET", "HEAD"].includes(request.method)) {
    return response;
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const candidates = [];

  if (path.endsWith("/")) {
    candidates.push(`${path}index.html`);
  } else if (!path.split("/").pop().includes(".")) {
    candidates.push(`${path}/index.html`);
  }

  candidates.push("/index.html");

  for (const candidate of candidates) {
    const assetUrl = new URL(request.url);
    assetUrl.pathname = candidate;
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (assetResponse.status !== 404) return assetResponse;
  }

  return response;
}

async function sendWebhook(env, payload) {
  if (!env.CAMP_SIGNUP_WEBHOOK_URL) {
    return Response.json({ message: "Message service is not configured." }, { status: 503 });
  }

  if (!env.CAMP_SIGNUP_WEBHOOK_SECRET) {
    return Response.json({ message: "Message service secret is not configured." }, { status: 503 });
  }

  const webhookResponse = await fetch(env.CAMP_SIGNUP_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!webhookResponse.ok) {
    return Response.json({ message: "Message service unavailable." }, { status: 502 });
  }

  return null;
}
