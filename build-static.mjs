import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const outDir = "dist";
const rootFiles = ["index.html", "styles.css", "script.js"];
const rootAssetExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const directories = ["assets", "best-games", "pictures for students page"];

function copyPath(source, target) {
  const stats = statSync(source);

  if (stats.isDirectory()) {
    mkdirSync(target, { recursive: true });

    for (const entry of readdirSync(source)) {
      copyPath(join(source, entry), join(target, entry));
    }

    return;
  }

  copyFileSync(source, target);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const file of rootFiles) {
  if (existsSync(file)) {
    copyPath(file, join(outDir, file));
  }
}

for (const entry of readdirSync(".")) {
  if (rootAssetExtensions.has(extname(entry).toLowerCase())) {
    copyPath(entry, join(outDir, entry));
  }
}

for (const directory of directories) {
  if (existsSync(directory)) {
    copyPath(directory, join(outDir, directory));
  }
}

if (existsSync(".openai")) {
  copyPath(".openai", join(outDir, ".openai"));
}

mkdirSync(join(outDir, "server"), { recursive: true });
writeFileSync(
  join(outDir, "server", "index.js"),
  `export default {
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
      const isEmail = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);

      if (website) {
        return Response.json({ message: "Accepted." }, { status: 202 });
      }

      if (!isEmail || !consent) {
        return Response.json({ message: "Email and consent are required." }, { status: 400 });
      }

      const signup = {
        email,
        source: payload.source || "camps-page",
        consent: "endgame-camp-announcements",
        submittedAt: new Date().toISOString(),
      };

      if (!env.CAMP_SIGNUP_WEBHOOK_URL) {
        return Response.json({ message: "Signup service is not configured." }, { status: 503 });
      }

      const webhookResponse = await fetch(env.CAMP_SIGNUP_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signup),
      });

      if (!webhookResponse.ok) {
        return Response.json({ message: "Signup service unavailable." }, { status: 502 });
      }

      return Response.json({ message: "Accepted." }, { status: 202 });
    }

    return env.ASSETS.fetch(request);
  },
};
`,
);
