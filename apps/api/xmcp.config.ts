import { type XmcpConfig } from "xmcp";
import { API_NAME } from "./src/identity";

const config: XmcpConfig = {
  http: true,
  paths: {
    tools: "./src/tools",
    prompts: "./src/prompts",
    resources: "./src/resources",
  },
  // The name xmcp gives the server (upstream leaves xmcp's default, "xmcp
  // server", which is what src/identity.ts spells): what `initialize` answers
  // and the landing page's title. One seam, so a product renames it once.
  template: { name: API_NAME },
};

export default config;
