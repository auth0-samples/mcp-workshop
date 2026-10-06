# Step 0: Prerequisites and tooling

## You need

- Node.js 22 or later (22.19 or later for the MCP Inspector)
- git
- A free [Auth0 account](https://auth0.com/signup) and tenant (from step 2)
- The [Auth0 CLI](https://auth0.github.io/auth0-cli/) (optional, every Auth0 step also has a Dashboard route)
- `cloudflared` or `ngrok` (from step 3)

## Run the server

```bash
cd server
npm install
npm run dev
```

The MCP endpoint is `http://localhost:3001/mcp`. For a production build, run `npm run build && npm start`.

## Test with the MCP Inspector

The [MCP Inspector](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector) (v2) is one package with three clients: web (default), CLI and TUI. With the server running, start it in another terminal:

```bash
npx @modelcontextprotocol/inspector --server-url http://localhost:3001/mcp --transport http
```

1. Open the URL the command prints. It contains a one-time session token, so don't type `localhost:6274` by hand.
2. On the **Servers** tab, connect to the server.
3. Open the **Tools** tab, pick a tool, fill in the form and call it.
4. The **Protocol** and **Network** tabs show the JSON-RPC traffic and the raw HTTP exchange, which is useful when debugging auth.

You can also launch with no target (`npx @modelcontextprotocol/inspector`) and add the server in the UI.

### CLI mode

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3001/mcp --transport http --method tools/list

npx @modelcontextprotocol/inspector --cli http://localhost:3001/mcp --transport http \
  --method tools/call --tool-name order_pizza --tool-arg topping=margherita --tool-arg size=large
```

Add `--format json` for machine-readable output. There is also a terminal UI: `npx @modelcontextprotocol/inspector --tui ...`.

### OAuth callback URLs

Once the server requires auth, the Inspector runs the OAuth flow for you. Its callback URLs are:

| Client    | Callback URL                           |
| --------- | -------------------------------------- |
| Web       | `http://localhost:6274/oauth/callback` |
| CLI / TUI | `http://127.0.0.1:6276/oauth/callback` |

Tokens are stored in `~/.mcp-inspector/storage/oauth.json`. Use **Clear OAuth state** in the web client, or `--relogin` in the CLI, to start over.

The old Inspector (v1) is still available with `npx @modelcontextprotocol/inspector@v1-latest`, but this guide uses v2.
