# Step 3: Add the client and CIMD file

Branch: `step-3-add-client`

So far the Inspector registered itself with Auth0 through Dynamic Client Registration (DCR), which creates a new client every time. A [Client ID Metadata Document](https://auth0.com/docs/get-started/auth0-overview/create-applications/register-applications-with-cimd) (CIMD) is the newer approach: the client's identity is a public HTTPS URL that serves a JSON document. An admin registers that URL once in Auth0, and the client uses the URL as its `client_id`.

```bash
git diff step-2-add-auth step-3-add-client
```

There are no server changes in this step. It only adds a `client/` folder.

## What changes

| File                          | Change                                        |
| ----------------------------- | --------------------------------------------- |
| `client/client-metadata.json` | New. The CIMD                                 |
| `client/server.js`            | New. A tiny static server that hosts the CIMD |
| `client/package.json`         | New. `npm start` runs the static server       |

## 1. The CIMD

`client/client-metadata.json`

```json
{
  "client_id": "https://example.com/client-metadata.json",
  "client_name": "MCP Workshop Client",
  "client_uri": "https://example.com",
  "application_type": "native",
  "redirect_uris": [
    "http://localhost:6274/oauth/callback",
    "http://127.0.0.1:6274/oauth/callback"
  ],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

- `client_id` must be the exact public URL where this file is served. You set it after you have a tunnel URL (below).
- `application_type` is `native` because the redirect URIs are loopback `http://` addresses. Auth0 only allows those for native apps. A `web` client (the default) must use `https://` redirect URIs.
- `redirect_uris` are the Inspector's callbacks. The web client uses `http://localhost:6274/oauth/callback`. If you use the Inspector CLI or TUI, add `http://127.0.0.1:6276/oauth/callback` too. Redirect URIs must match exactly.
- `token_endpoint_auth_method: none` makes this a public client. It uses PKCE, with no client secret. Auth0 only accepts `none` or `private_key_jwt` for CIMD clients.

Auth0 validates the document when you register it:

| Rule                   | Requirement                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Required fields        | `client_id`, `client_name`, and `grant_types` including `authorization_code` or `refresh_token`                |
| `client_id`            | An `https` URL that exactly matches where the document is hosted                                              |
| URL                    | `https`, not `localhost`, has a path beyond `/`, 120 bytes at most, no query, fragment, credentials or port 0 |
| `redirect_uris`        | Required with `authorization_code`. Unique and `https`, except loopback addresses for `native` apps           |
| Size and redirects     | The document is 5 KB at most, and Auth0 doesn't follow redirects when fetching it                             |
| Optional               | `logo_uri`, and `description` (140 characters at most)                                                        |

## 2. The static server

`client/server.js`

```js
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const PORT = process.env.PORT ?? 3000;
const FILE = new URL("./client-metadata.json", import.meta.url);

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
    return res.end();
  }

  if (req.method === "GET" && pathname === "/client-metadata.json") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    });
    return res.end(await readFile(FILE));
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
}).listen(PORT, () => {
  console.log(`CIMD served at http://localhost:${PORT}/client-metadata.json`);
});
```

`client/package.json`

```json
{
  "name": "mcp-workshop-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js"
  }
}
```

Start it:

```bash
cd client
npm start
```

It reads the file on every request, so edits take effect without a restart.

## 3. Expose it with a tunnel

Auth0 fetches the CIMD over the internet, so `localhost` won't do. Expose port 3000 with a tunnel.

### Cloudflare Tunnel (cloudflared)

Free, and quick tunnels need no account.

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

It prints a URL like `https://random-words.trycloudflare.com`. A quick tunnel gets a new URL each time it starts.

### ngrok

Needs a free account and a one-time auth token.

```bash
brew install ngrok
ngrok config add-authtoken <your-token>
ngrok http 3000
```

The free plan includes one static domain, which keeps the URL stable between runs:

```bash
ngrok http --url=your-name.ngrok-free.app 3000
```

### Set `client_id`

Put the full URL, including the path, into `client/client-metadata.json`:

```json
{
  "client_id": "https://random-words.trycloudflare.com/client-metadata.json"
}
```

Check it from the outside:

```bash
curl https://random-words.trycloudflare.com/client-metadata.json
```

If the tunnel URL changes, update `client_id` and register the new URL again.

## 4. Auth0 setup

Each sub-step has a **Dashboard** route and a **CLI** route. Navigation uses the [new Dashboard sidebar](00-prerequisites.md#auth0-dashboard-navigation), with the old name in brackets where it differs. The CLI snippets use these variables:

```bash
export AUTH0_DOMAIN=your-tenant.eu.auth0.com
export MCP_AUDIENCE=http://localhost:3001/mcp
export CIMD_URL=https://random-words.trycloudflare.com/client-metadata.json
```

Step 2 already made the database connection domain-level and created the API with its default third-party grant, and both still apply to CIMD clients.

### 4.1 Enable CIMD on the tenant

This makes Auth0 advertise CIMD support in its metadata, so clients know they can use a URL as their `client_id`.

**Dashboard**

1. Open **Settings**, then the **Advanced** tab.
2. In the **Settings** section, turn on **Client ID Metadata Document Registration**.
3. Keep **Resource Parameter Compatibility Profile** on.
4. Save.

**CLI**

```bash
auth0 api patch "tenants/settings" --data '{ "client_id_metadata_document_supported": true }'
```

Check it. The flag is a top-level tenant setting, and it shows up in Auth0's public discovery document:

```bash
auth0 api get "tenants/settings" | jq .client_id_metadata_document_supported

curl -s "https://$AUTH0_DOMAIN/.well-known/openid-configuration" | jq .client_id_metadata_document_supported
```

Both print `true`.

> CIMD clients are always strict third-party clients, and logins fail while legacy **Rules** are active on the tenant. If you have Rules, migrate them to Actions first.

### 4.2 Register the CIMD as an application

An admin registers the CIMD URL once. Auth0 fetches it, validates it, and creates a third-party application whose client ID is the URL itself. The tunnel and the static server must be running.

**Dashboard**

1. Open **Integration > Applications** (old: **Applications > Applications**).
2. Click **Create Application**, then choose **Import from URL**.
3. Enter the tunnel URL, for example `https://random-words.trycloudflare.com/client-metadata.json`, and click **Preview**. Auth0 checks the URL rules and loads the document.
4. Review the metadata and fix any validation errors or warnings.
5. Click **Create**.

To pick up later edits to the document, open the application, click **Refresh Client Metadata** (top right), then **Refresh Preview**, then **Save**.

**CLI**

Preview first. The response shows the fields Auth0 mapped and a `validation` block with warnings:

```bash
auth0 api post "clients/cimd/preview" --data "{ \"external_client_id\": \"$CIMD_URL\" }"
```

Then register it:

```bash
CIMD_CLIENT_ID=$(auth0 api post "clients/cimd/register" --data "{ \"external_client_id\": \"$CIMD_URL\" }" | jq -r .client_id)

echo "$CIMD_CLIENT_ID"
```

The printed client ID is the CIMD URL. Check it:

```bash
auth0 api get clients -q "external_client_id=$CIMD_URL" | jq '.[] | {name, client_id, is_first_party, app_type}'
```

> If registration is rejected, the error names the rule that failed. Common causes are a `client_id` that differs from the URL you entered, a tunnel that isn't running, and `http://` redirect URIs without `"application_type": "native"`.

### 4.3 Give the client access to the API

Third-party applications need an explicit grant to use an API. In step 2 you gave every third-party app a default grant, which already covers the CIMD client. For a CIMD client it is better to grant access to this client only, so you control exactly who can reach the API.

**Dashboard**

1. Open **Integration > APIs > MCP Tools API** and the **Settings** tab.
2. In **Application Access Policy**, set **User-Delegated Access** to **Per-app authorization** (this replaces the default grant from step 2 for your API) and save.
3. Open the **Application Access** tab, find `MCP Workshop Client`, and click **Edit**.
4. Under **User Access**, choose **Authorized**, select the scopes (none are needed yet), and save.

**CLI**

```bash
auth0 api post "client-grants" --data "{
  \"client_id\": \"$CIMD_CLIENT_ID\",
  \"audience\": \"$MCP_AUDIENCE\",
  \"subject_type\": \"user\",
  \"scope\": []
}"
```

Check it:

```bash
auth0 api get client-grants -q "audience=$MCP_AUDIENCE" | jq '[.[] | {client_id, default_for, subject_type, scope}]'
```

If you stay with the default third-party grant from step 2, this sub-step is optional. Keeping both is fine, since a per-application grant overrides the default for the same API.

### 4.4 Optional: switch off Dynamic Client Registration

To prove that the Inspector now identifies itself through the CIMD, turn DCR off again. It also closes the open registration endpoint.

**Dashboard:** **Settings > Advanced**, turn off **Dynamic Client Registration (DCR)**, and save.

**CLI**

```bash
auth0 api patch "tenants/settings" --data '{ "flags": { "enable_dynamic_client_registration": false } }'
```

## 5. Use it from the Inspector

Point the Inspector at your CIMD instead of relying on DCR.

- **Web client:** open the server's **Client Settings** and enter the CIMD URL as the client metadata URL.
- **CLI or TUI:** pass it as a flag.

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3001/mcp --transport http \
  --client-metadata-url "$CIMD_URL" \
  --method tools/list
```

The Auth0 login page now shows your client, `MCP Workshop Client`, rather than a randomly registered one.

## Troubleshooting

| Symptom                                       | Likely cause                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Preview** fails                             | The tunnel isn't running, or `client_id` doesn't equal the URL you entered                                           |
| Validation error about `redirect_uris`        | Loopback `http://` redirect URIs need `"application_type": "native"`                                                 |
| `client_id_metadata_document_supported` is `false` | CIMD isn't enabled on the tenant (4.1)                                                                          |
| Login fails straight away                     | Legacy Rules are active on the tenant. CIMD clients require Actions instead                                          |
| `redirect_uri` mismatch at login              | The Inspector's callback URL isn't listed in `redirect_uris`, or differs by `localhost` vs `127.0.0.1`               |
| Login succeeds but no token for the API       | The application has no grant for `MCP Tools API` (4.3), and no default third-party grant                              |
| Worked before, fails now                      | The quick tunnel URL changed. Update `client_id`, register the new URL, and refresh the client metadata              |

## Checkpoint

The client is identified by its CIMD, and the Inspector logs in through it. Next: [Step 4: Per-tool permissions](04-tool-permissions.md).
