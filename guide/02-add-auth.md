# Step 2: Add Auth0 authentication

Branch: `step-2-add-auth`

Protect the MCP server with Auth0 using the [`@xmcp-dev/auth0`](https://xmcp.dev/docs/integrations/auth0) plugin, and make both tools aware of the user calling them. The Inspector will register itself with Auth0 through Dynamic Client Registration (DCR). Step 3 swaps that for a CIMD.

```bash
git diff step-1-start-state step-2-add-auth
```

## What changes

| File                              | Change                                            |
| --------------------------------- | ------------------------------------------------- |
| `server/package.json`             | Adds the `@xmcp-dev/auth0` dependency             |
| `server/src/middleware.ts`        | New. Registers the Auth0 provider                 |
| `server/.env.example`             | New. Template for the environment variables       |
| `server/src/tools/whoami.ts`      | Reads the authenticated user with `getAuthInfo()` |
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

| Option                     | Meaning                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `domain`                   | Your Auth0 tenant domain                                                           |
| `audience`                 | The identifier of the API you create in Auth0. Also the MCP server's resource URL  |
| `baseURL`                  | The MCP server's base URL                                                          |
| `clientId`, `clientSecret` | A Machine-to-Machine app the server uses to call the Auth0 Management API          |

### `.env.example`

Copy it to `.env` (ignored by git) and fill it in after the Auth0 setup below.

```bash
# Your Auth0 tenant domain, for example my-tenant.eu.auth0.com
DOMAIN=your-tenant.auth0.com

# The identifier of the API you create in Auth0. It must match the MCP endpoint URL exactly, including /mcp.
AUDIENCE=http://localhost:3001/mcp

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

| Field         | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `token`       | The raw access token                                           |
| `clientId`    | The OAuth client that obtained the token                       |
| `scopes`      | Scopes from the token (permissions are merged in)              |
| `permissions` | Permissions from the token's `permissions` claim, when present |
| `expiresAt`   | Expiry timestamp                                               |
| `user`        | `sub`, plus `name` and `email` when the token carries them     |

## 2. Auth0 tenant setup

Each sub-step has a **Dashboard** route and a **CLI** route. Do one of them. Navigation uses the [new Dashboard sidebar](00-prerequisites.md#auth0-dashboard-navigation), with the old name in brackets where it differs. Set up the CLI first if you want to use it ([Auth0 CLI](00-prerequisites.md#auth0-cli)).

The CLI snippets share two shell variables. Set them once in the terminal you use for the Auth0 steps, and keep `/mcp` on the audience.

```bash
export AUTH0_DOMAIN=your-tenant.eu.auth0.com
export MCP_AUDIENCE=http://localhost:3001/mcp
```

### 2.1 Enable Dynamic Client Registration and MCP settings

Dynamic Client Registration (DCR) lets a client such as the Inspector register itself at runtime. The two other settings make Auth0 behave the way MCP clients expect:

| Setting                                        | Why                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Dynamic Client Registration (DCR)              | Lets the Inspector create its own client. Off by default on every tenant                       |
| Resource Parameter Compatibility Profile       | Lets clients ask for a token with the standard `resource` parameter instead of Auth0's `audience` |
| Include Issuer in Authorization Responses      | Adds the `iss` parameter to authorization responses, which guards against mix-up attacks       |

**Dashboard**

1. Open **Settings** in the sidebar, then the **Advanced** tab.
2. In the **Settings** section, turn on:
   - **Dynamic Client Registration (DCR)** (some docs call it "OIDC Dynamic Application Registration")
   - **Resource Parameter Compatibility Profile** (already on for new tenants)
   - **Include Issuer in Authorization Responses**
3. Save.

**CLI**

```bash
auth0 api patch "tenants/settings" --data '{
  "flags": { "enable_dynamic_client_registration": true },
  "resource_parameter_profile": "compatibility",
  "authorization_response_iss_parameter_supported": true
}'
```

Check it:

```bash
auth0 api get "tenants/settings" | jq '{
  dcr: .flags.enable_dynamic_client_registration,
  resource_parameter_profile,
  authorization_response_iss_parameter_supported
}'

curl -s "https://$AUTH0_DOMAIN/.well-known/openid-configuration" | jq .registration_endpoint
```

The second command prints `https://<tenant>/oidc/register` once DCR is on, and `null` when it is off.

> **Security note.** With DCR on, the `/oidc/register` endpoint accepts requests without a token, so anyone who knows your tenant domain can create applications in it. That is fine for a workshop tenant. Don't leave it on in a tenant that matters. Step 3 replaces DCR with a CIMD and shows how to switch it off again.

### 2.2 Make a database connection available to MCP clients

MCP clients are third-party applications, and third-party applications can only use **domain-level** connections.

**Dashboard**

1. Open **Integration > Authentication** (old: **Authentication > Database**) and choose **Database**.
2. Open `Username-Password-Authentication` (or the connection your users sign in with).
3. Open the **Settings** tab, scroll to **Promote Connection to Domain Level**, usually in the **Advanced** section, and turn it on.
4. Click **Save Changes**.

**CLI**

```bash
CONN_ID=$(auth0 api get connections -q "name=Username-Password-Authentication" | jq -r '.[0].id')

auth0 api patch "connections/$CONN_ID" --data '{ "is_domain_connection": true }'
```

Check it:

```bash
auth0 api get connections -q "name=Username-Password-Authentication" | jq '.[0] | {id, name, is_domain_connection}'
```

### 2.3 Create the API

The API is the resource server that represents your MCP server. Its identifier becomes the token audience, and the MCP server's resource URL.

**Dashboard**

1. Open **Integration > APIs** (old: **Applications > APIs**) and click **Create API**.
2. Name: `MCP Tools API`
3. Identifier: `http://localhost:3001/mcp`
4. Signing algorithm: `RS256`
5. Click **Create**.
6. On the API's **Settings** tab, turn on **Allow Offline Access** so clients can get refresh tokens, and save.

**CLI**

```bash
auth0 apis create \
  --name "MCP Tools API" \
  --identifier "$MCP_AUDIENCE" \
  --signing-alg RS256 \
  --token-lifetime 86400 \
  --offline-access=true
```

Check it:

```bash
auth0 apis show "$MCP_AUDIENCE" --json | jq '{id, name, identifier, signing_alg, allow_offline_access}'
```

> The identifier can't be changed after creation. It must equal `AUDIENCE` in your `.env` exactly, including `/mcp`.

### 2.4 Allow third-party clients to use the API

A client that registers itself can't be configured one by one, so give **all third-party applications** a default grant on the API. Without it, logins fail or return a token with no access to your API.

**Dashboard**

1. Open **Integration > APIs > MCP Tools API** and the **Settings** tab.
2. In **Default Permissions for Third Party Apps** (part of the **Application Access Policy** section), set **User-Delegated Access** to **Authorized**.
3. Save.

**CLI**

```bash
auth0 api post "client-grants" --data "{
  \"default_for\": \"third_party_clients\",
  \"audience\": \"$MCP_AUDIENCE\",
  \"subject_type\": \"user\",
  \"scope\": []
}"
```

Check it:

```bash
auth0 api get client-grants -q "audience=$MCP_AUDIENCE" | jq '[.[] | {client_id, default_for, subject_type, scope}]'
```

### 2.5 Create a Machine-to-Machine application

The plugin asks the Management API which permissions exist and which the user holds (see [step 4](04-tool-permissions.md)). It does this on every tool call, so the M2M application is needed from this step on. Give it exactly two Management API permissions:

- `read:resource_servers`
- `read:users`

**Dashboard**

1. Open **Integration > Applications** (old: **Applications > Applications**) and click **Create Application**.
2. Name: `MCP Server (Management API)`. Choose **Machine to Machine Applications** and click **Create**.
3. Select the **Auth0 Management API**, tick `read:resource_servers` and `read:users`, and click **Authorize**.
4. On the application's **Settings** tab, copy the **Domain**, **Client ID** and **Client Secret**.

**CLI**

```bash
M2M=$(auth0 apps create \
  --name "MCP Server (Management API)" \
  --type m2m \
  --reveal-secrets \
  --json)

M2M_CLIENT_ID=$(echo "$M2M" | jq -r .client_id)
M2M_CLIENT_SECRET=$(echo "$M2M" | jq -r .client_secret)

auth0 api post "client-grants" --data "{
  \"client_id\": \"$M2M_CLIENT_ID\",
  \"audience\": \"https://$AUTH0_DOMAIN/api/v2/\",
  \"scope\": [\"read:resource_servers\", \"read:users\"]
}"
```

Check it:

```bash
auth0 api get client-grants -q "client_id=$M2M_CLIENT_ID" | jq '.[] | {audience, scope}'
```

### 2.6 Environment variables

**Dashboard route:** copy the values by hand.

```bash
cd server
cp .env.example .env
```

Fill in `DOMAIN`, `CLIENT_ID` and `CLIENT_SECRET` from the M2M application. Leave `AUDIENCE=http://localhost:3001/mcp` and `BASE_URL=http://localhost:3001` as they are.

**CLI route:** write the file from the variables you already have.

```bash
cat > server/.env <<EOF
DOMAIN=$AUTH0_DOMAIN
AUDIENCE=$MCP_AUDIENCE
BASE_URL=http://localhost:3001
CLIENT_ID=$M2M_CLIENT_ID
CLIENT_SECRET=$M2M_CLIENT_SECRET
EOF
```

`.env` is ignored by git. Never commit the client secret.

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

Open the printed URL and connect. The Inspector gets a `401`, discovers Auth0, registers itself through DCR, and opens the Auth0 login page. Sign in (sign up first if you have no users) and consent. Then:

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

To see the client the Inspector registered, open **Integration > Applications**. A new third-party application appears each time the Inspector registers itself, which is the mess that CIMD avoids.

## Troubleshooting

| Symptom                                           | Likely cause                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `invalid_token`                                   | `DOMAIN` or `AUDIENCE` doesn't match the tenant and API exactly, including `/mcp`             |
| `Service not found` during login                  | The API identifier isn't exactly the resource URL, including `/mcp`             |
| OAuth initialisation fails, or no `registration_endpoint` | DCR or the Resource Parameter Compatibility Profile isn't enabled (2.1)                      |
| Login works but access is denied                  | The connection isn't domain-level (2.2), or there is no default third-party grant on the API (2.4)   |
| The token has no access to the API                | The default third-party grant is missing or doesn't allow user-delegated access (2.4)                |
| `You don't have permission to use the '...' tool` | The Management API call failed (wrong M2M credentials or missing grants), which is denied by design |
| `getAuthInfo()` throws                            | It was called outside a tool handler, or `middleware.ts` doesn't default-export the provider         |
| CLI says required scopes have changed             | Run `auth0 login` again and approve the prompt                                                       |

## Checkpoint

Unauthenticated requests are rejected, and the tools know who is calling. Next: [Step 3: Add the client and CIMD file](03-add-client-cimd.md).
