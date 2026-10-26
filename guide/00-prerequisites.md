# Step 0: Prerequisites and tooling

## You need

- Node.js 22 or later (22.19 or later for the MCP Inspector)
- git
- A free [Auth0 account](https://auth0.com/signup) and tenant (from step 2)
- The [Auth0 CLI](https://auth0.github.io/auth0-cli/) and [`jq`](https://jqlang.org/) (optional: every Auth0 step is documented for both the Dashboard and the CLI)
- `cloudflared` or `ngrok` (from step 3)

## Run the server

```bash
cd server
npm install
npm run dev
```

The MCP endpoint is `http://localhost:3001/mcp`. For a production build, run `npm run build && npm start`.

## Auth0 Dashboard navigation

The Auth0 Dashboard has a new sidebar with labeled sections. The guide uses the new names, with the old ones in brackets where they differ. The new navigation is an Early Access feature, and the profile menu has a toggle to switch between the new and the old layout.

| What you need                   | New navigation                                   | Old navigation                       |
| ------------------------------- | ------------------------------------------------ | ------------------------------------ |
| Tenant settings (General, Advanced) | **Settings**                                 | **Settings**                         |
| Applications                    | **Integration > Applications**                   | **Applications > Applications**      |
| APIs                            | **Integration > APIs**                           | **Applications > APIs**              |
| Database connections            | **Integration > Authentication > Database**      | **Authentication > Database**        |
| Roles                           | **Integration > Authorization** (Roles)          | **User Management > Roles**          |
| Users                           | **Users**                                        | **User Management > Users**          |

Settings tabs such as **Advanced** and **General** keep their names. If an item isn't where the guide says, use the search in the Dashboard or switch to the other layout.

## Auth0 CLI

Every Auth0 step in this guide has a **Dashboard** route and a **CLI** route. Pick whichever you prefer.

```bash
# install (macOS)
brew tap auth0/auth0-cli
brew install auth0

# log in. The extra scopes are needed for the raw `auth0 api` calls in this guide.
auth0 login --scopes "read:tenant_settings,update:tenant_settings,read:connections,update:connections,read:resource_servers,update:resource_servers,read:clients,create:clients,update:clients,read:client_grants,create:client_grants"

# check you are on the right tenant
auth0 tenants list
```

If a command says the required scopes have changed, run `auth0 login` again and approve the prompt. To switch tenant, use `auth0 tenants use <tenant>` or pass `--tenant <tenant>` to any command.

How the CLI is used in this guide:

- `auth0 apis`, `auth0 roles`, `auth0 users` and `auth0 apps` are dedicated commands.
- `auth0 api <get|post|patch> <path>` calls any [Management API](https://auth0.com/docs/api/management/v2) endpoint. It is used for tenant settings, connections, client grants and CIMD.
- `--json` makes a dedicated command print JSON, which the snippets pipe into `jq` to capture IDs.

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
