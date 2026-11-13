# api-tests

The server's vitest suite (the template's tool, prompt and resources, the health check, and an MCP client's exchange with the built Worker in-process), run with pnpm test

The test suite for **api**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/api`          |
| Package      | `@app/api-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
