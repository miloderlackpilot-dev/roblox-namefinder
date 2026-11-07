const ALLOWED_ORIGIN = "https://miloderlackpilot-dev.github.io";
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Vary": "Origin"
};

function json(data, status = 200, origin = ALLOWED_ORIGIN, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, "Access-Control-Allow-Origin": origin, ...extraHeaders }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    if (origin !== ALLOWED_ORIGIN) return json({ status: "unknown", detail: "Origin not allowed." }, 403);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
      }});
    }
    if (url.pathname === "/metrics" && request.method === "GET") {
      const id = env.RATE_CONTROLLER.idFromName("global");
      return env.RATE_CONTROLLER.get(id).fetch("https://controller/metrics");
    }
    if (request.method !== "POST") return json({ status: "unknown", detail: "Use POST." }, 405);
    if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
      return json({ status: "unknown", detail: "Send a JSON request body." }, 415);
    }
    let body;
    try { body = await request.json(); }
    catch { return json({ status: "unknown", detail: "Invalid JSON request body." }, 400); }
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return json({ status: "invalid", detail: "Username must contain 3 to 20 letters, numbers, or underscores." });
    }
    const id = env.RATE_CONTROLLER.idFromName("global");
    return env.RATE_CONTROLLER.get(id).fetch("https://controller/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
  }
};

export class RateController {
  constructor(state) {
    this.state = state;
    this.queue = Promise.resolve();
    this.defaults = {
      minIntervalMs: 2500,
      intervalMs: 2500,
      maxIntervalMs: 30000,
      cooldownUntil: 0,
      checked: 0,
      available: 0,
      taken: 0,
      invalid: 0,
      limited: 0,
      errors: 0,
      consecutiveSuccesses: 0,
      lastStatus: "Waiting for checks",
      lastDetail: "",
      lastCheckAt: 0,
      inbound: [],
      outbound: []
    };
    this.ready = state.storage.get("controller").then((saved) => {
      this.metrics = { ...this.defaults, ...(saved || {}) };
    });
  }

  async persist() {
    await this.state.storage.put("controller", this.metrics);
  }

  prune(now) {
    this.metrics.inbound = this.metrics.inbound.filter((time) => now - time < 60000);
    this.metrics.outbound = this.metrics.outbound.filter((time) => now - time < 60000);
  }

  snapshot() {
    const now = Date.now();
    this.prune(now);
    return {
      websiteRequestsPerMinute: this.metrics.inbound.length,
      robloxChecksPerMinute: this.metrics.outbound.length,
      websiteRequestsTotal: this.metrics.websiteRequestsTotal || 0,
      robloxChecksTotal: this.metrics.checked,
      available: this.metrics.available,
      taken: this.metrics.taken,
      invalid: this.metrics.invalid,
      rateLimited: this.metrics.limited,
      errors: this.metrics.errors,
      intervalMs: this.metrics.intervalMs,
      targetChecksPerMinute: Math.round(60000 / this.metrics.intervalMs),
      cooldownUntil: this.metrics.cooldownUntil,
      lastStatus: this.metrics.lastStatus,
      lastDetail: this.metrics.lastDetail,
      lastCheckAt: this.metrics.lastCheckAt,
      consecutiveSuccesses: this.metrics.consecutiveSuccesses,
      controller: "adaptive",
      updatedAt: now
    };
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    if (url.pathname === "/metrics" && request.method === "GET") {
      return json(this.snapshot());
    }
    if (url.pathname !== "/check" || request.method !== "POST") {
      return json({ status: "unknown", detail: "Not found." }, 404);
    }
    const work = this.queue.then(() => this.check(request));
    this.queue = work.then(() => undefined, () => undefined);
    return work;
  }

  async check(request) {
    const now = Date.now();
    this.metrics.inbound.push(now);
    this.metrics.websiteRequestsTotal = (this.metrics.websiteRequestsTotal || 0) + 1;
    this.prune(now);

    let body;
    try { body = await request.json(); }
    catch {
      this.metrics.errors += 1;
      this.metrics.lastStatus = "Invalid request";
      await this.persist();
      return json({ status: "unknown", detail: "Invalid request body." }, 400);
    }
    const username = typeof body.username === "string" ? body.username : "";
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      this.metrics.invalid += 1;
      this.metrics.lastStatus = "Invalid username";
      await this.persist();
      return json({ status: "invalid", detail: "Username format is invalid." });
    }

    const waitUntil = Math.max(this.metrics.cooldownUntil, this.metrics.lastCheckAt + this.metrics.intervalMs);
    const delay = waitUntil - Date.now();
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    const sentAt = Date.now();
    this.metrics.outbound.push(sentAt);
    this.metrics.lastCheckAt = sentAt;
    this.prune(sentAt);
    const upstreamUrl = new URL("https://auth.roblox.com/v1/usernames/validate");
    upstreamUrl.searchParams.set("request.username", username);
    upstreamUrl.searchParams.set("request.birthday", "2000-01-01T00:00:00.000Z");
    upstreamUrl.searchParams.set("request.context", "Signup");

    try {
      const upstream = await fetch(upstreamUrl, { headers: { "Accept": "application/json" } });
      if (upstream.status === 429) {
        const retryAfter = Number(upstream.headers.get("Retry-After"));
        const cooldownMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 3600000) : Math.max(60000, this.metrics.intervalMs * 10);
        this.metrics.limited += 1;
        this.metrics.consecutiveSuccesses = 0;
        this.metrics.intervalMs = Math.min(this.metrics.maxIntervalMs, Math.max(5000, this.metrics.intervalMs * 2));
        this.metrics.cooldownUntil = Date.now() + cooldownMs;
        this.metrics.lastStatus = "Roblox rate limited";
        this.metrics.lastDetail = "Paused until cooldown expires. Rate reduced.";
        await this.persist();
        return json({ status: "ratelimited", detail: this.metrics.lastDetail, retryAfterMs: cooldownMs }, 429, ALLOWED_ORIGIN, { "Retry-After": String(Math.ceil(cooldownMs / 1000)) });
      }
      if (!upstream.ok) {
        this.metrics.errors += 1;
        this.metrics.consecutiveSuccesses = 0;
        this.metrics.lastStatus = "Roblox HTTP " + upstream.status;
        this.metrics.lastDetail = "Roblox did not confirm this check.";
        await this.persist();
        return json({ status: "unknown", detail: this.metrics.lastDetail }, 502);
      }
      const data = await upstream.json();
      const code = Number(data.code);
      let result;
      if (code === 0) { result = "available"; this.metrics.available += 1; }
      else if (code === 1) { result = "taken"; this.metrics.taken += 1; }
      else if (code === 2) { result = "invalid"; this.metrics.invalid += 1; }
      else {
        this.metrics.errors += 1;
        this.metrics.consecutiveSuccesses = 0;
        this.metrics.lastStatus = "Unknown Roblox response";
        await this.persist();
        return json({ status: "unknown", detail: "Roblox returned an unrecognized validation code." }, 502);
      }
      this.metrics.checked += 1;
      this.metrics.consecutiveSuccesses += 1;
      this.metrics.cooldownUntil = 0;
      if (this.metrics.consecutiveSuccesses >= 20 && this.metrics.intervalMs > this.metrics.minIntervalMs) {
        this.metrics.intervalMs = Math.max(this.metrics.minIntervalMs, Math.ceil(this.metrics.intervalMs * 0.95));
        this.metrics.consecutiveSuccesses = 0;
      }
      this.metrics.lastStatus = "Healthy";
      this.metrics.lastDetail = "";
      await this.persist();
      return json({ status: result });
    } catch {
      this.metrics.errors += 1;
      this.metrics.consecutiveSuccesses = 0;
      this.metrics.lastStatus = "Connection error";
      this.metrics.lastDetail = "Could not reach Roblox username validation.";
      await this.persist();
      return json({ status: "unknown", detail: this.metrics.lastDetail }, 502);
    }
  }
}
