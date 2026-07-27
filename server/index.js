export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/camp-notifications" && request.method === "POST") {
      let payload;

      try {
        payload = await request.json();
      } catch {
        return Response.json({ message: "Invalid request." }, { status: 400 });
      }

      const email = String(payload.email || "").trim();
      const consent = payload.consent === true;
      const website = String(payload.website || "").trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (website) {
        return Response.json({ message: "Accepted." }, { status: 202 });
      }

      if (!isEmail || !consent) {
        return Response.json({ message: "Email and consent are required." }, { status: 400 });
      }

      const signup = {
        type: "camp-notification",
        email,
        source: payload.source || "camps-page",
        consent: "endgame-camp-announcements",
        submittedAt: new Date().toISOString(),
        secret: env.CAMP_SIGNUP_WEBHOOK_SECRET || "",
      };

      const result = await sendWebhook(env, signup);
      if (result) {
        return result;
      }

      return Response.json({ message: "Accepted." }, { status: 202 });
    }

    if (url.pathname === "/api/contact" && request.method === "POST") {
      let payload;

      try {
        payload = await request.json();
      } catch {
        return Response.json({ message: "Invalid request." }, { status: 400 });
      }

      const name = String(payload.name || "").trim();
      const email = String(payload.email || "").trim();
      const level = String(payload.level || "").trim();
      const message = String(payload.message || "").trim();
      const website = String(payload.website || "").trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (website) {
        return Response.json({ message: "Accepted." }, { status: 202 });
      }

      if (!isEmail || !message) {
        return Response.json({ message: "Email and message are required." }, { status: 400 });
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
        return result;
      }

      return Response.json({ message: "Accepted." }, { status: 202 });
    }

    return env.ASSETS.fetch(request);
  },
};

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
