# Step 2: Add Auth0 authentication

Branch: `step-2-add-auth`

Protect the MCP server with Auth0 using the [`@xmcp-dev/auth0`](https://xmcp.dev/docs/integrations/auth0) plugin, and make both tools aware of the user calling them.

```bash
git diff step-1-start-state step-2-add-auth
```

## What changes

| File                            | Change                                              |
| ------------------------------- | --------------------------------------------------- |
| `server/package.json`           | Adds the `@xmcp-dev/auth0` dependency               |
| `server/src/middleware.ts`      | New. Registers the Auth0 provider                   |
| `server/.env.example`           | New. Template for the environment variables         |
| `server/src/tools/whoami.ts`    | Reads the authenticated user with `getAuthInfo()`   |
| `server/src/tools/order-pizza.ts` | Addresses the order to the authenticated user     |

## What the plugin does

`auth0Provider` returns an Express middleware and router that xmcp mounts in front of the MCP endpoint:

- Serves `/.well-known/oauth-protected-resource` so clients can discover that Auth0 is the authorization server.
- Serves `/.well-known/oauth-authorization-server`, copied from your tenant's OpenID configuration.
- Rejects any `/mcp` request without a valid bearer token with `401` and a `WWW-Authenticate` header. The Inspector follows that header to start the OAuth flow.
- Verifies the access token's signature, expiry and audience against your tenant.
- Makes the verified user available to your tools through `getAuthInfo()`.

## 1. Code

```bash
cd server
npm install @xmcp-dev/auth0
```

### `src/middleware.ts`

xmcp loads this file automatically. The provider must be its default export.

```ts
import { auth0Provider } from "@xmcp-dev/auth0";

export default auth0Provider({
  domain: process.env.DOMAIN!,
  audience: process.env.AUDIENCE!,
  baseURL: process.env.BASE_URL!,
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
});
```

| Option                     | Meaning                                                                         |
| -------------------------- | ------------------------------------------------------------------------------- |
| `domain`                   | Your Auth0 tenant domain                                                         |
| `audience`                 | The identifier of the API you create in Auth0. Also the MCP server's resource URL |
| `baseURL`                  | The MCP server's base URL                                                        |
| `clientId`, `clientSecret` | A Machine-to-Machine app the server uses to call the Auth0 Management API        |

### `.env.example`

Copy it to `.env` (ignored by git) and fill it in after the Auth0 setup below.

```bash
# Your Auth0 tenant domain, for example my-tenant.eu.auth0.com
DOMAIN=your-tenant.auth0.com

# The identifier of the API you create in Auth0. It must match exactly, including the trailing slash.
AUDIENCE=http://localhost:3001/

# Base URL of this MCP server
BASE_URL=http://localhost:3001

# Machine-to-Machine application used to call the Auth0 Management API
CLIENT_ID=your-m2m-client-id
CLIENT_SECRET=your-m2m-client-secret
```

### `src/tools/whoami.ts`

The handler no longer takes the `extra` argument. `getAuthInfo()` returns the verified token data, and it only works inside a tool handler on an authenticated request.

```ts
import { type ToolMetadata } from "xmcp";
import { getAuthInfo } from "@xmcp-dev/auth0";

export const schema = {};

export const metadata: ToolMetadata = {
  name: "whoami",
  description: "Returns information about the user calling this tool",
  annotations: {
    title: "Who am I?",
    readOnlyHint: true,
    idempotentHint: true,
  },
};

export default async function whoami() {
  const authInfo = getAuthInfo();

  return JSON.stringify(
    {
      sub: authInfo.user.sub,
      name: authInfo.user.name,
      email: authInfo.user.email,
      clientId: authInfo.clientId,
      scopes: authInfo.scopes,
    },
    null,
    2
  );
}
```

### `src/tools/order-pizza.ts`

Only the import and the handler change. The schema and metadata are the same as in step 1.

```ts
import { getAuthInfo } from "@xmcp-dev/auth0";

export default async function orderPizza({ topping, size }: InferSchema<typeof schema>) {
  const { user } = getAuthInfo();
  const customer = user.name ?? user.email ?? user.sub;

  return [
    `One ${size} ${topping} pizza is on its way to ${customer}!`,
    `Order ID: ${crypto.randomUUID()}`,
    `Estimated delivery: 25 minutes`,
  ].join("\n");
}
```

`AuthInfo` fields you can use:

| Field         | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `token`       | The raw access token                                               |
| `clientId`    | The OAuth client that obtained the token                           |
| `scopes`      | Scopes from the token (permissions are merged in)                  |
| `permissions` | Permissions from the token's `permissions` claim, when present     |
| `expiresAt`   | Expiry timestamp                                                   |
| `user`        | `sub`, plus `name` and `email` when the token carries them         |

## 2. Auth0 tenant setup

You can do all of this in the [Auth0 Dashboard](https://manage.auth0.com). Where it helps, the equivalent Auth0 CLI command is shown. Replace `http://localhost:3001/` if your server runs elsewhere, and keep the trailing slash everywhere.

### 2.1 Tenant settings

**Settings > Advanced**, then turn on and save:

- **Resource Parameter Compatibility Profile**: lets MCP clients request a token with the standard `resource` parameter instead of Auth0's `audience`.
- **Include Issuer in Authorization Responses**
- **OIDC Dynamic Application Registration**: lets clients such as the Inspector register themselves. Step 3 replaces this with a CIMD, but it keeps step 2 working out of the box.

### 2.2 Make a database connection available to MCP clients

MCP clients are third-party applications, so they can only use **domain-level** connections.

**Authentication > Database > `Username-Password-Authentication`**, then enable third-party client access or promote the connection to the domain level.

```bash
auth0 api get connections
auth0 api patch connections/YOUR_CONNECTION_ID --data '{"is_domain_connection": true}'
```

### 2.3 Create the API

**Applications > APIs > Create API**

- Name: `MCP Tools API`
- Identifier: `http://localhost:3001/`
- Signing algorithm: `RS256`

Then set it as the default audience: **Settings > General > API Authorization Settings > Default Audience**, enter `http://localhost:3001/` and save.

### 2.4 Create a Machine-to-Machine application

The plugin asks the Management API which permissions exist and which the user holds (see [step 4](04-tool-permissions.md)). It does this on every tool call, so the M2M application is needed from this step on.

1. **Applications > Applications > Create Application**, choose **Machine to Machine Applications**.
2. Authorize it for the **Auth0 Management API** with these permissions:
   - `read:resource_servers`
   - `read:users`
3. From the application's **Settings** tab, copy the **Domain**, **Client ID** and **Client Secret**.

### 2.5 Environment variables

```bash
cd server
cp .env.example .env
```

Fill in `DOMAIN`, `CLIENT_ID` and `CLIENT_SECRET`. Leave `AUDIENCE=http://localhost:3001/` and `BASE_URL=http://localhost:3001` as they are.

## 3. Try it

```bash
cd server
npm install
npm run dev
```

In another terminal:

```bash
npx @modelcontextprotocol/inspector --server-url http://localhost:3001/mcp --transport http
```

Open the printed URL and connect. The Inspector gets a `401`, discovers Auth0, registers itself, and opens the Auth0 login page. Sign in (sign up first if you have no users) and consent. Then:

- `whoami` returns your Auth0 `sub`, name, email and the client ID.
- `order_pizza` addresses the order to you.

You can check the unauthenticated behaviour yourself:

```bash
curl -i -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The response is `401 Unauthorized` with `WWW-Authenticate: Bearer resource_metadata="/.well-known/oauth-protected-resource"`.

## Troubleshooting

| Symptom                                           | Likely cause                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `invalid_token`                                   | `DOMAIN` or `AUDIENCE` doesn't match the tenant and API exactly, including the trailing slash     |
| `Service not found` during login                  | The API identifier isn't exactly the resource URL, including the trailing slash                   |
| OAuth initialisation fails                        | Resource Parameter Compatibility Profile or OIDC Dynamic Application Registration isn't enabled   |
| Login works but access is denied                  | The connection isn't domain-level, or the default audience isn't set                              |
| `You don't have permission to use the '...' tool` | The Management API call failed (wrong M2M credentials or missing grants), which is denied by design |
| `getAuthInfo()` throws                            | It was called outside a tool handler, or `middleware.ts` doesn't default-export the provider      |

## Checkpoint

Unauthenticated requests are rejected, and the tools know who is calling. Next: [Step 3: Add the client and CIMD file](03-add-client-cimd.md).
