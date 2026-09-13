import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../server/index.js";

const env = {
  CAMP_SIGNUP_WEBHOOK_URL: "https://example.test/webhook",
  CAMP_SIGNUP_WEBHOOK_SECRET: "test-secret",
};
const origin = "https://aveskulov.com";
const forms = [
  ["contact", { email: "test@example.test", message: "Test inquiry" }],
  ["camp-notifications", { email: "test@example.test", consent: true, endgameLevel: "basic", learningGoals: "Rook endings" }],
];

for (const [route, payload] of forms) {
  test(`${route}: only confirmed webhook acceptance succeeds`, async (t) => {
    const scenarios = [
      ["confirmed", () => Response.json({ ok: true }), 202],
      ["rejected with HTTP 200", () => Response.json({ ok: false, message: "Unauthorized." }), 502],
      ["missing confirmation", () => Response.json({}), 502],
      ["null response", () => Response.json(null), 502],
      ["HTML error with HTTP 200", () => new Response("<html>Authorization required</html>"), 502],
      ["HTTP error", () => new Response("Unavailable", { status: 503 }), 502],
      ["network failure", () => { throw new TypeError("fetch failed"); }, 502],
      ["timeout", () => { throw new DOMException("Timed out", "TimeoutError"); }, 504],
    ];
    for (const [name, reply, expected] of scenarios) {
      await t.test(name, async (t) => {
        t.mock.method(console, "error", () => {});
        t.mock.method(globalThis, "fetch", async (url, options) => {
          assert.equal(url, env.CAMP_SIGNUP_WEBHOOK_URL);
          assert.equal(JSON.parse(options.body).secret, env.CAMP_SIGNUP_WEBHOOK_SECRET);
          assert.ok(options.signal instanceof AbortSignal);
          return reply();
        });
        const response = await worker.fetch(new Request(`https://example.test/api/${route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify(payload),
        }), env);
        assert.equal(response.status, expected);
        assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
        assert.equal(typeof (await response.json()).message, "string");
      });
    }
  });
}

