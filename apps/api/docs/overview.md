# api

The xmcp server (a tool, a prompt and two resources over Streamable HTTP at /mcp, one Cloudflare Worker, per environment)

A Cloudflare Worker, deployed per environment by its CI lane.

|              |                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Type         | `cloudflare-worker-turbo`                                                                                          |
| Source       | `apps/api`                                                                                                         |
| Package      | `@app/api`                                                                                                         |
| Environments | `dev`: `verify` · `stage`: `verify`, `deploy` on a push to `main` · `prod`: `verify`, `deploy` on a push to `main` |

## Depends on

- (none)

## Depended on by

- (none)
