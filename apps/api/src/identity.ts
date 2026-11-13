// The server's identity, written once. xmcp.config.ts hands it to xmcp as the
// template name, so an MCP client's `initialize` reads it back as the server's
// name and the landing page at / carries it as its title; GET /health answers
// with it too (src/health.ts). A deploy's smoke, an operator's curl and a
// connected client all see which server answered. The Orun bootstrap that
// creates a product rewrites it to that product's name, so keep it literal
// and on one line.
export const API_NAME = "Xmcp Mcp Server"
