# Step 3: Add the client and CIMD file

Branch: `step-3-add-client`

So far the Inspector registered itself with Auth0 through Dynamic Client Registration (DCR), which creates a new client every time. A [Client ID Metadata Document](https://auth0.com/ai/docs/mcp/guides/registering-your-mcp-client-application) (CIMD) is the newer approach: the client's identity is a public HTTPS URL that serves a JSON document. An admin registers that URL once in Auth0, and the client uses the URL as its `client_id`.

```bash
git diff step-2-add-auth step-3-add-client
```

There are no server changes in this step. It only adds a `client/` folder.

## What changes

| File                           | Change                                       |
| ------------------------------ | -------------------------------------------- |
| `client/client-metadata.json`  | New. The CIMD                                |
| `client/server.js`             | New. A tiny static server that hosts the CIMD |
| `client/package.json`          | New. `npm start` runs the static server       |

## 1. The CIMD

`client/client-metadata.json`

```json
{
  "client_id": "https://example.com/client-metadata.json",
  "client_name": "MCP Workshop Client",
  "client_uri": "https://example.com",
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
- `redirect_uris` are the Inspector's callbacks. The web client uses `http://localhost:6274/oauth/callback`. If you use the Inspector CLI or TUI, add `http://127.0.0.1:6276/oauth/callback` too. Redirect URIs must match exactly.
- `token_endpoint_auth_method: none` makes this a public client. It uses PKCE, with no client secret.

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

## 4. Register the CIMD in Auth0

1. **Settings > Advanced**, turn on **Client ID Metadata Document Registration** and save. Keep **Resource Parameter Compatibility Profile** on.
2. **Applications > Applications > Create Application > Import from URL**.
3. Enter the tunnel URL, for example `https://random-words.trycloudflare.com/client-metadata.json`, and select **Preview**. Auth0 fetches the document and validates it.
4. Fix any errors shown, then select **Create**.

The resulting application's client ID is the CIMD URL itself.

CIMD clients are third-party applications, which has two consequences:

- They can only use **domain-level** connections. You set this up in [step 2](02-add-auth.md#22-make-a-database-connection-available-to-mcp-clients).
- They need an API access policy that lets them request tokens for your API. In the new application's settings, open **APIs** (or set the tenant's default third-party policy under **Applications > APIs > MCP Tools API > Application Access**) and allow user access to `MCP Tools API`.

## 5. Use it from the Inspector

Point the Inspector at your CIMD instead of relying on DCR.

- **Web client:** open the server's **Client Settings** and enter the CIMD URL as the client metadata URL.
- **CLI or TUI:** pass it as a flag.

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3001/mcp --transport http \
  --client-metadata-url https://random-words.trycloudflare.com/client-metadata.json \
  --method tools/list
```

The Auth0 login page now shows your client, `MCP Workshop Client`, rather than a randomly registered one.

## Troubleshooting

| Symptom                                       | Likely cause                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Preview** fails                             | The tunnel isn't running, or `client_id` doesn't equal the URL you entered                            |
| Preview reports a validation error            | Check the document against Auth0's CIMD rules. Some tenants also require `application_type` (`native` or `web`) |
| `redirect_uri` mismatch at login              | The Inspector's callback URL isn't listed in `redirect_uris`, or differs by `localhost` vs `127.0.0.1` |
| Login succeeds but no token for the API       | The application has no access policy for `MCP Tools API`                                              |
| Worked before, fails now                      | The quick tunnel URL changed. Update `client_id` and register the new URL                            |

## Checkpoint

The client is identified by its CIMD, and the Inspector logs in through it. Next: [Step 4: Per-tool permissions](04-tool-permissions.md).
