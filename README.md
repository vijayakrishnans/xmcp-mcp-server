# xmcp-mcp-server

A remote [Model Context Protocol](https://modelcontextprotocol.io) server on
one **Cloudflare Worker**, built with [xmcp](https://xmcp.dev): each tool,
prompt and resource is a file under `apps/api/src/` — a `greet` tool, a
`review-code` prompt, an app-config resource and a user-profile resource
template — and xmcp serves them over Streamable HTTP at `/mcp`.
`xmcp build --cf` compiles them into xmcp's own Worker (`apps/api/worker.js`),
which wrangler deploys through `apps/api/src/worker.ts`. Every merge to
`main` deploys it to stage, then prod.

## Live deployment

<!-- 02-docs:begin -->
This MCP server is **live**: MCP clients connect to
`https://xmcp-mcp-server-api-prod.vijayakrishnan12994.workers.dev/mcp`. Verified URLs, identity and the secrets it uses are
recorded in [ai/context/deployment.md](ai/context/deployment.md) (re-rendered
by the `02-docs` phase); how it deploys and how to operate it:
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## Connecting an MCP client

Point the client at the Worker's `/mcp` URL —
`https://xmcp-mcp-server-api-prod.vijayakrishnan12994.workers.dev/mcp` — as a
remote (Streamable HTTP) server. For a client that only speaks stdio, bridge
it with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "xmcp-mcp-server": {
      "command": "npx",
      "args": ["mcp-remote", "https://xmcp-mcp-server-api-prod.vijayakrishnan12994.workers.dev/mcp"]
    }
  }
}
```

The server is **stateless**: it issues no session id, so any isolate answers
any call and nothing is kept between requests. It serves no server-to-client
stream (a `GET /mcp` is a 405). It is also **open**: anyone with the URL can
list and call its tools, prompts and resources. Put authentication in front
of it before it does anything that is not public — xmcp has its own (an API
key or OAuth, configured in `xmcp.config.ts` or a `src/middleware.ts`); see
also "Adding a binding or a secret".

## Routes

| Route | Answers |
|---|---|
| `POST /mcp` | the MCP server, over Streamable HTTP: `initialize`, then tools, prompts and resources (`tools/list`, `tools/call`, `prompts/list`, `prompts/get`, `resources/list`, `resources/templates/list`, `resources/read`) |
| `GET /` | xmcp's landing page, titled with the server's name, with the `/mcp` URL to connect to |
| `GET /health` | `{"status":"ok","transport":"cloudflare-workers","mode":"stateless","auth":"none","name":"<API_NAME>","environment":"<env>"}` — what the deploy's smoke and an operator's probe read |
| anything else | `404` (`GET /mcp`: `405`) |

## What is here

| Surface | Where |
|---|---|
| The tools, prompts and resources — one file each | `apps/api/src/{tools,prompts,resources}/` |
| xmcp's configuration (HTTP transport, the folders, the server's name) | `apps/api/xmcp.config.ts` |
| The Worker's entry (xmcp's build, with `/health` naming the server and its environment) | `apps/api/src/worker.ts`, `apps/api/src/health.ts` |
| The server's name (what `initialize`, the landing page and `/health` answer with) | `apps/api/src/identity.ts` |
| Worker config (name, compatibility date, per-environment vars) | `apps/api/wrangler.jsonc` |
| Deploy contract | `apps/api/component.yaml` (`cloudflare-worker-turbo`) |
| Tests | `tests/api` (vitest: the files called directly, the health check, and an MCP client's exchange with the built Worker in-process) |

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test             # builds the server first (xmcp build --cf), then the suite
pnpm build            # xmcp build --cf, then wrangler deploy --dry-run → apps/api/dist (no upload)
```

Run it locally: `xmcp dev` reloads on save (Node); `preview` builds the
Worker and serves it under workerd, as Cloudflare runs it:

```bash
pnpm --filter @app/api dev                 # xmcp dev
pnpm --filter @app/api preview             # xmcp build --cf, then wrangler dev → http://localhost:8787
curl http://localhost:8787/health          # {"status":"ok",…,"environment":"local"}
curl -X POST http://localhost:8787/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"greet","arguments":{"name":"Ada"}}}'
npx @modelcontextprotocol/inspector         # an MCP client in the browser: connect to http://localhost:8787/mcp
```

Add a tool by adding a file to `apps/api/src/tools/`: a zod `schema`, a
`metadata` object and a default export that does the work (`greet.ts` is
one). Prompts go in `src/prompts/`, resources in `src/resources/` (the folder
path is the URI: `(users)/[userId]/index.ts` is `users://{userId}`). Keep
`/health` and the `greet` tool, or change the smoke with them: the deploy's
smoke reads `/health`, then calls `greet`.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The server deploys to `stage`, then to
`prod` once stage has converged on the same commit; `dev` only verifies. The
Worker is `xmcp-mcp-server-api-<env>` on your account's workers.dev subdomain, and
every deploy is smoke-tested over HTTP: `/health` must answer `"status":"ok"`
for that environment, an MCP `initialize` at `/mcp` must come back with the
server's identity, and a `tools/call` of `greet` with its greeting. A pull request
runs the same pipeline's verify lanes: the Worker built, type-checked and
dry-deployed for each environment, with nothing deployed. They do not lint or
run the tests, so run `pnpm typecheck`, `pnpm lint` and `pnpm test` before
you push. (A push to `main` builds, deploys and smoke-tests.)

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare token and account id are brokered per run from the workspace's
Cloudflare connection; nothing provider-shaped is stored in the repository
or in GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after rotating a
secret, say. A component with nothing to run in that environment (a test
suite in `prod`) is left out with a notice.

## Adding a binding or a secret

The Worker binds nothing today, so `wrangler.jsonc` is committed as it
deploys (a tool that needs storage or state gets a binding). To give it a KV namespace, a D1 database or an R2 bucket, add the
resource under `infra/` as its own component and have `apps/api/component.yaml`
depend on it; `tooling/wire/` renders a wrangler template from the ids that
component publishes. A runtime secret (an API key for a service a tool
calls, or the token clients must present once you add authentication) is an Orun secret: `orun secrets set <KEY> --org <ws> --env <env>`,
declared in the component's `optionalSecretEnv` and named in its
`runtimeSecrets`, then pushed to the Worker after each deploy. Until it is
set, the tool that needs it should say so rather than fail.

## Custom domain

The server answers on workers.dev from its first deploy. To serve it on your own
domain, add the domain to the Cloudflare account the server deploys into and
attach it to the Worker (dashboard → Workers & Pages → `xmcp-mcp-server-api-prod` →
Settings → Domains & Routes → Add → Custom domain); do the same for stage
with a subdomain if you want one. The workers.dev URL keeps answering, and the
deploy's smoke keeps reading it — unless the environment sets `DEPLOYED_URL`
in `intent.yaml`, which the smoke reads instead:

```yaml
environments:
  prod:
    env:
      DEPLOYED_URL: https://xmcp-mcp-server.example.com
```

The repository names the domain in one place, `BASE_DOMAIN` in `intent.yaml`
(one line per environment), which the server was born with as the reserved
placeholder `xmcp-mcp-server.example.com` — the example above carries it too. MCP
clients then connect to `https://<your domain>/mcp`.
Replace it with your domain in the same change that attaches it.

## Credits

The server is Vercel's xmcp boilerplate
([vercel/examples](https://github.com/vercel/examples), `framework-boilerplates/xmcp`,
MIT — `apps/api/LICENSE.md`), built with [xmcp](https://github.com/basementstudio/xmcp).
