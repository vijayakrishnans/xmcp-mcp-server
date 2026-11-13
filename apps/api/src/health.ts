import { API_NAME } from "./identity"

// `vars.ENVIRONMENT` in wrangler.jsonc: `local` under a bare `wrangler dev`,
// and the environment's name in each `env.<name>` section the deploy targets.
export type Env = {
  ENVIRONMENT?: string
}

type Ctx = { waitUntil(promise: Promise<unknown>): void }

export type Fetcher = {
  fetch(request: Request, env: Env, ctx: Ctx): Response | Promise<Response>
}

// xmcp's Worker, with one thing added. Its own GET /health answers
// `{"status":"ok","transport":…,"mode":…,"auth":…}`; this keeps every field
// and adds the server's name and the environment whose config the Worker runs,
// so a 200 here is THIS server, deployed to THAT environment — what the
// deploy's smoke and the bootstrap's probe read. Every other request goes to
// xmcp untouched.
export function withHealth(inner: Fetcher): Fetcher {
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url)
      if (request.method !== "GET" || url.pathname !== "/health") {
        return inner.fetch(request, env, ctx)
      }
      const res = await inner.fetch(request, env, ctx)
      let body: Record<string, unknown> = {}
      try {
        body = (await res.json()) as Record<string, unknown>
      } catch {
        body = { status: "error" }
      }
      const headers = new Headers(res.headers)
      headers.delete("content-length")
      headers.set("content-type", "application/json")
      return new Response(
        JSON.stringify({ ...body, name: API_NAME, environment: env?.ENVIRONMENT ?? "unknown" }),
        { status: res.status, headers },
      )
    },
  }
}
