// The Worker's entry. `xmcp build --cf` compiles the tools, prompts and
// resources under src/ into worker.js beside package.json — xmcp's own
// Cloudflare Worker: Streamable HTTP at /mcp (stateless), a landing page at /
// and a health check. wrangler bundles THIS file, which serves that Worker
// with the health check naming the server and its environment (src/health.ts).
// @ts-ignore -- worker.js is the build's output (`xmcp build --cf`, which the build script runs before wrangler bundles this file) and carries no types.
import xmcp from "../worker.js"
import { withHealth, type Fetcher } from "./health"

export default withHealth(xmcp as Fetcher)
