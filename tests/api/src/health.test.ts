import { describe, expect, it } from "vitest";
import { withHealth, type Fetcher } from "@/health";
import { API_NAME } from "@/identity";

// src/health.ts over a stand-in for xmcp's Worker: what it adds to /health,
// and that it leaves every other request to xmcp.

const ctx = { waitUntil() {} };

function inner(answer: () => Response): Fetcher & { seen: Request[] } {
  const seen: Request[] = [];
  return {
    seen,
    fetch(request) {
      seen.push(request);
      return answer();
    },
  };
}

const xmcpHealth = () =>
  new Response(JSON.stringify({ status: "ok", transport: "cloudflare-workers", mode: "stateless", auth: "none" }), {
    status: 200,
    headers: { "content-type": "application/json", "content-length": "81", "access-control-allow-origin": "*" },
  });

describe("GET /health", () => {
  it("keeps xmcp's fields and adds the server's name and this environment", async () => {
    const worker = withHealth(inner(xmcpHealth));
    const res = await worker.fetch(new Request("http://local/health"), { ENVIRONMENT: "stage" }, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      transport: "cloudflare-workers",
      mode: "stateless",
      auth: "none",
      name: API_NAME,
      environment: "stage",
    });
  });

  it("drops xmcp's content-length (the body grew) and keeps its other headers", async () => {
    const res = await withHealth(inner(xmcpHealth)).fetch(new Request("http://local/health"), { ENVIRONMENT: "prod" }, ctx);
    expect(res.headers.get("content-length")).toBeNull();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("content-type")).toBe("application/json");
  });

  it("says `unknown` when the Worker runs no environment's config", async () => {
    const res = await withHealth(inner(xmcpHealth)).fetch(new Request("http://local/health"), {}, ctx);
    expect((await res.json()) as { environment: string }).toMatchObject({ environment: "unknown" });
  });

  it("reports an error, never ok, when xmcp's answer is not JSON", async () => {
    const res = await withHealth(inner(() => new Response("boom", { status: 500 }))).fetch(
      new Request("http://local/health"),
      { ENVIRONMENT: "stage" },
      ctx,
    );
    expect(res.status).toBe(500);
    expect((await res.json()) as { status: string }).toMatchObject({ status: "error", environment: "stage" });
  });
});

describe("everything else", () => {
  it("goes to xmcp untouched", async () => {
    const answer = new Response("from xmcp", { status: 202 });
    const stub = inner(() => answer);
    const worker = withHealth(stub);
    for (const request of [
      new Request("http://local/mcp", { method: "POST", body: "{}" }),
      new Request("http://local/"),
      new Request("http://local/health", { method: "POST" }),
      new Request("http://local/healthz"),
    ]) {
      expect(await worker.fetch(request, { ENVIRONMENT: "stage" }, ctx)).toBe(answer);
    }
    expect(stub.seen.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      "POST /mcp",
      "GET /",
      "POST /health",
      "GET /healthz",
    ]);
  });
});
