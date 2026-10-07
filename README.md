# MCP Workshop

A hands-on workshop that builds an MCP server with [xmcp](https://xmcp.dev) and secures it with [Auth0 for MCP](https://auth0.com/ai/docs/mcp/intro/overview). You start with an open server that has two tools (`whoami` and `order_pizza`), then add Auth0 authentication, register the MCP client with a Client ID Metadata Document (CIMD), and finally restrict each tool with per-tool permissions assigned through Auth0 roles.

Each step of the workshop is a git branch, and every code change and Auth0 setting is documented in the [`guide/`](guide/README.md) folder.

## Related content

- [Auth0 for MCP](https://auth0.com/ai/docs/mcp/intro/overview): how Auth0 authenticates and authorizes MCP clients.
- [Register your MCP client application](https://auth0.com/ai/docs/mcp/guides/registering-your-mcp-client-application): Dynamic Client Registration and CIMD in Auth0.
- [xmcp Auth0 integration](https://xmcp.dev/docs/integrations/auth0): the `@xmcp-dev/auth0` plugin used in this workshop.
- [MCP Inspector](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector): the client used to test the server.

## Steps

| Step | Branch                    | What you get                                                          |
| ---- | ------------------------- | --------------------------------------------------------------------- |
| 1    | `step-1-start-state`      | Barebones xmcp server with two tools: `whoami` and `order_pizza`      |
| 2    | `step-2-add-auth`         | The server is protected by Auth0 and both tools know who is calling   |
| 3    | `step-3-add-client`       | A `client/` folder that serves the Client ID Metadata Document (CIMD) |
| 4    | `step-4-tool-permissions` | Each tool call is checked against a per-tool permission               |

Each branch builds on the previous one. `main` is the same as `step-1-start-state`. The `guide/` folder is identical on every branch.

## Requirements

- [Node.js](https://nodejs.org) 22 or later (22.19 or later for the MCP Inspector) and npm
- [git](https://git-scm.com)
- An [Auth0](https://auth0.com/signup) account and tenant (from step 2)
- The [Auth0 CLI](https://auth0.github.io/auth0-cli/) and [`jq`](https://jqlang.org/) (optional, every Auth0 step also has a Dashboard route)
- [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) or [ngrok](https://ngrok.com/download) to expose the CIMD file (from step 3)

Step 1 only needs Node.js and git.

## Download and run

Clone the repository and start from the first step:

```bash
git clone https://github.com/atko-cic-devrel/mcp-workshop.git
cd mcp-workshop
git checkout step-1-start-state
```

Install and start the server:

```bash
cd server
npm install
npm run dev
```

The MCP endpoint is now available at `http://localhost:3001/mcp`. In another terminal, connect with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector --server-url http://localhost:3001/mcp --transport http
```

Open the URL the command prints (it contains a one-time session token), connect to the server on the **Servers** tab, then call `whoami` or `order_pizza` from the **Tools** tab.

To move on, check out the next branch and follow its guide:

```bash
git checkout step-2-add-auth
```

Steps 2 to 4 need an Auth0 tenant. Create a `server/.env` from `server/.env.example` and fill in the values as described in the [step 2 guide](guide/02-add-auth.md). Run `npm install` in `server/` after switching branches, because the dependencies change in step 2. Step 3 adds the `client/` folder, which you start with `cd client && npm start`.

## Guide

Follow the steps in order:

0. [Prerequisites and tooling](guide/00-prerequisites.md)
1. [Start state](guide/01-start-state.md)
2. [Add Auth0 authentication](guide/02-add-auth.md)
3. [Add the client and CIMD file](guide/03-add-client-cimd.md)
4. [Per-tool permissions](guide/04-tool-permissions.md)

## License

Copyright 2026 Okta, Inc.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at:

http://www.apache.org/licenses/LICENSE-2.0

See [LICENSE.txt](LICENSE.txt) for the full license text and [NOTICE.txt](NOTICE.txt) for the licenses of the third-party dependencies.
