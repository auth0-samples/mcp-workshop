# MCP Workshop

Build and secure an MCP server with [xmcp](https://xmcp.dev) and [Auth0 for MCP](https://auth0.com/ai/docs/mcp/intro/overview). Each step of the workshop is a git branch, and every change is documented in the [`guide/`](guide/README.md) folder.

| Step | Branch                    | What you get                                                          |
| ---- | ------------------------- | --------------------------------------------------------------------- |
| 1    | `step-1-start-state`      | Barebones xmcp server with two tools: `whoami` and `order_pizza`      |
| 2    | `step-2-add-auth`         | The server is protected by Auth0 and both tools know who is calling   |
| 3    | `step-3-add-client`       | A `client/` folder that serves the Client ID Metadata Document (CIMD) |
| 4    | `step-4-tool-permissions` | Each tool call is checked against a per-tool permission               |

Each branch builds on the previous one. The `guide/` folder is identical on every branch.

```bash
git checkout step-1-start-state
```

Start with the [guide](guide/README.md).
