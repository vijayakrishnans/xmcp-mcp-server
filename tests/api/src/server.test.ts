import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { withHealth, type Fetcher } from "@/health";
import { API_NAME } from "@/identity";

// The server the Worker runs: worker.js, which `xmcp build --cf` writes (the
// build runs first: this package depends on @app/api, and turbo's `test`
// waits on `^build`), served through src/health.ts exactly as src/worker.ts
// serves it — but called in-process, with no workerd. The MCP calls are the
// SDK's own client over Streamable HTTP, its transport's fetch pointed at the
// Worker's fetch handler. Under workerd, the app's `preview` script
// (`xmcp build --cf`, then `wrangler dev`) serves the same exchange.

const built = path.resolve(__dirname, "../../../apps/api/worker.js");
const env = { ENVIRONMENT: "test" };
const ctx = { waitUntil() {} };
let worker: Fetcher;
let client: Client;
let transport: StreamableHTTPClientTransport;

const call = (input: string | URL | Request, init?: RequestInit) =>
  Promise.resolve(worker.fetch(new Request(input, init), env, ctx));

beforeAll(async () => {
  if (!existsSync(built)) throw new Error(`${built} is missing: run the app's build (xmcp build --cf) first`);
  const { default: xmcp } = (await import(pathToFileURL(built).href)) as { default: Fetcher };
  worker = withHealth(xmcp);
  client = new Client({ name: "api-tests", version: "1.0.0" });
  transport = new StreamableHTTPClientTransport(new URL("http://local/mcp"), { fetch: call });
  await client.connect(transport);
});

afterAll(async () => {
  await client?.close();
});

describe("an MCP client's exchange", () => {
  it("initializes with the server's name, and no session (stateless)", () => {
    expect(client.getServerVersion()?.name).toBe(API_NAME);
    expect(transport.sessionId).toBeUndefined();
    expect(client.getServerCapabilities()).toMatchObject({ tools: {}, prompts: {}, resources: {} });
  });

  it("lists the template's one tool and calls it", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(["greet"]);
    expect(tools[0]?.annotations).toMatchObject({ title: "Greet the user", readOnlyHint: true });
    const result = await client.callTool({ name: "greet", arguments: { name: "Ada" } });
    expect(result.content).toEqual([{ type: "text", text: "Hello, Ada!!" }]);
  });

  it("refuses a call whose arguments the schema rejects", async () => {
    const result = await client.callTool({ name: "greet", arguments: { name: 42 } }).catch((e: Error) => e);
    const refused = result instanceof Error || (result as { isError?: boolean }).isError === true;
    expect(refused).toBe(true);
  });

  it("lists the prompt and fills it", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(["review-code"]);
    const prompt = await client.getPrompt({ name: "review-code", arguments: { code: "let x = 1" } });
    const message = prompt.messages[0];
    expect(message?.role).toBe("user");
    expect(message?.content).toMatchObject({ type: "text" });
    expect((message?.content as { text: string }).text).toContain("let x = 1");
  });

  it("lists the static resource and the templated one, and reads both", async () => {
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual(["config://app"]);
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((r) => r.uriTemplate)).toEqual(["users://{userId}"]);
    const config = await client.readResource({ uri: "config://app" });
    expect(config.contents).toEqual([{ uri: "config://app", text: "App configuration here" }]);
    const user = await client.readResource({ uri: "users://42" });
    expect(user.contents).toEqual([{ uri: "users://42", text: "Profile data for user 42" }]);
  });
});

describe("the Worker's other routes", () => {
  it("serves xmcp's landing page at /, titled with the server's name", async () => {
    const res = await call("http://local/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain(`<title>${API_NAME}</title>`);
  });

  it("answers /health with the server's name and the environment", async () => {
    const res = await call("http://local/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", mode: "stateless", name: API_NAME, environment: "test" });
  });

  it("refuses a GET on /mcp (no server-to-client stream) and 404s an unknown path", async () => {
    expect((await call("http://local/mcp")).status).toBe(405);
    expect((await call("http://local/no-such-route")).status).toBe(404);
  });
});
