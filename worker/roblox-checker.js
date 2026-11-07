const ALLOWED_ORIGIN = "https://miloderlackpilot-dev.github.io";
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Vary": "Origin"
};

function json(data, status, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      "Access-Control-Allow-Origin": origin
    }
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    if (origin !== ALLOWED_ORIGIN) {
      return json({ status: "unknown", detail: "Origin not allowed." }, 403);
    }
    if (request.method !== "POST") {
      return json({ status: "unknown", detail: "Use POST." }, 405);
    }

    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return json({ status: "unknown", detail: "Send a JSON request body." }, 415);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ status: "unknown", detail: "Invalid JSON request body." }, 400);
    }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return json({ status: "invalid", detail: "Username must contain 3 to 20 letters, numbers, or underscores." }, 200);
    }

    const upstreamUrl = new URL("https://auth.roblox.com/v1/usernames/validate");
    upstreamUrl.searchParams.set("request.username", username);
    upstreamUrl.searchParams.set("request.birthday", "2000-01-01T00:00:00.000Z");
    upstreamUrl.searchParams.set("request.context", "Signup");

    try {
      const upstream = await fetch(upstreamUrl, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (upstream.status === 429) {
        return json({ status: "ratelimited", detail: "Roblox rate-limited this request." }, 429);
      }
      if (!upstream.ok) {
        return json({ status: "unknown", detail: "Roblox returned HTTP " + upstream.status + "." }, 502);
      }

      const data = await upstream.json();
      const code = Number(data.code);
      if (code === 0) return json({ status: "available" }, 200);
      if (code === 1) return json({ status: "taken" }, 200);
      if (code === 2) return json({ status: "invalid" }, 200);
      return json({ status: "unknown", detail: "Roblox returned an unrecognized validation code." }, 502);
    } catch {
      return json({ status: "unknown", detail: "Could not reach Roblox username validation." }, 502);
    }
  }
};
