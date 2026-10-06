# Step 4: Per-tool permissions

Branch: `step-4-tool-permissions`

Restrict each tool to the users who hold the matching Auth0 permission. This is built into the `@xmcp-dev/auth0` plugin, so almost everything in this step is Auth0 configuration.

```bash
git diff step-3-add-client step-4-tool-permissions
```

## What changes

| File                         | Change                                            |
| ---------------------------- | ------------------------------------------------- |
| `server/src/tools/whoami.ts` | Also returns the permissions carried by the token |

That is the only code change. Enforcement is already active from step 2.

## How it works

For every tool call, the plugin builds the permission name `tool:<metadata.name>` and checks:

1. Is that permission defined on your Auth0 API? It asks the Management API (`read:resource_servers`).
   - **Not defined:** the tool is public, and any user with a valid token can call it.
   - **Defined:** continue.
2. Does the calling user hold that permission? It asks the Management API (`read:users`).
   - **Yes:** the call goes through.
   - **No:** the call is refused.

| Tool          | Permission to define in Auth0 |
| ------------- | ----------------------------- |
| `whoami`      | `tool:whoami`                 |
| `order_pizza` | `tool:order_pizza`            |

The name comes from `metadata.name` in each tool file, so `order_pizza` uses an underscore.

Things worth knowing:

- **Opt-in protection.** Until you define `tool:<name>` on the API, the tool stays open to every authenticated user.
- **Fails closed.** If the Management API can't be reached or the M2M grants are missing, the call is denied.
- **The refusal is a tool result, not an HTTP error.** The server answers `200` with a JSON-RPC result whose text says `You don't have permission to use the '<tool>' tool.`. Clients see it as the tool's output.
- **Checked live on each call.** The plugin reads permissions from the Management API every time rather than caching, so changes to roles apply on the next call with no new login. The downside is Management API rate limits under load.
- **Listing isn't filtered.** `tools/list` returns every tool. Only calls are checked.

## 1. Code

`whoami` now also returns `authInfo.permissions`, which lets you see what the access token carries.

```ts
export default async function whoami() {
  const authInfo = getAuthInfo();

  return JSON.stringify(
    {
      sub: authInfo.user.sub,
      name: authInfo.user.name,
      email: authInfo.user.email,
      clientId: authInfo.clientId,
      scopes: authInfo.scopes,
      permissions: authInfo.permissions ?? [],
    },
    null,
    2
  );
}
```

`permissions` is read from the token's `permissions` claim. It only appears when the API has RBAC enabled and permissions are added to the access token (2.2 below). The plugin's enforcement doesn't depend on it, because it asks the Management API, but it is the quickest way to see what a user holds.

## 2. Auth0 setup

Each sub-step has a **Dashboard** route and a **CLI** route. Do one of them. Navigation uses the [new Dashboard sidebar](00-prerequisites.md#auth0-dashboard-navigation), with the old name in brackets where it differs. The CLI snippets use these variables, and the IDs you capture in one sub-step are reused in the next, so stay in the same terminal:

```bash
export AUTH0_DOMAIN=your-tenant.eu.auth0.com
export MCP_AUDIENCE=http://localhost:3001/
```

### 2.1 Define the permissions on the API

The moment a permission exists on the API, the matching tool stops being public.

| Permission         | Description                 |
| ------------------ | --------------------------- |
| `tool:whoami`      | Access the whoami tool      |
| `tool:order_pizza` | Access the order_pizza tool |

**Dashboard**

1. Open **Integration > APIs** (old: **Applications > APIs**) and select `MCP Tools API`.
2. Open the **Permissions** tab.
3. Under **Add a Permission (Scope)**, enter the permission and its description, then click **Add**. Repeat for the second permission.

**CLI**

```bash
API_ID=$(auth0 apis show "$MCP_AUDIENCE" --json | jq -r .id)

auth0 api patch "resource-servers/$API_ID" --data '{
  "scopes": [
    { "value": "tool:whoami",      "description": "Access the whoami tool" },
    { "value": "tool:order_pizza", "description": "Access the order_pizza tool" }
  ]
}'
```

The `scopes` array replaces the API's full list, so include every permission you want to keep. If you don't need descriptions, this shorter form also works:

```bash
auth0 apis update "$MCP_AUDIENCE" --scopes "tool:whoami,tool:order_pizza"
```

Check it:

```bash
auth0 apis scopes list "$MCP_AUDIENCE"
```

### 2.2 Enable RBAC and put permissions in the token

Turning on RBAC makes Auth0 only grant permissions that the user holds through a role. Adding permissions to the access token adds a `permissions` claim, which `whoami` displays.

**Dashboard**

1. On `MCP Tools API`, open the **Settings** tab and scroll to **RBAC Settings**.
2. Turn on **Enable RBAC**.
3. Turn on **Add Permissions in the Access Token**.
4. Save.

**CLI**

```bash
auth0 api patch "resource-servers/$API_ID" --data '{
  "enforce_policies": true,
  "token_dialect": "rfc9068_profile_authz"
}'
```

| Field              | Value                   | Meaning                                                                             |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------- |
| `enforce_policies` | `true`                  | Enable RBAC                                                                         |
| `token_dialect`    | `rfc9068_profile_authz` | RFC 9068 JWT access token, plus the `permissions` claim                              |

`access_token_authz` is the equivalent for Auth0's default token format, and is what the Dashboard toggle switches to from `access_token`. Either works with the plugin.

Check it:

```bash
auth0 apis show "$MCP_AUDIENCE" --json | jq '{enforce_policies, token_dialect}'
```

### 2.3 Create roles

| Role            | Permissions                       |
| --------------- | --------------------------------- |
| `Workshop User` | `tool:whoami`                     |
| `Pizza Orderer` | `tool:whoami`, `tool:order_pizza` |

**Dashboard**

1. Open **Integration > Authorization** (old: **User Management > Roles**), choose **Roles**, and click **Create Role**.
2. Enter the name and description, and click **Create**.
3. Open the role's **Permissions** tab and click **Add Permissions**.
4. Select `MCP Tools API`, tick the permissions from the table, and click **Add Permissions**.
5. Repeat for the second role.

**CLI**

```bash
WORKSHOP_USER_ROLE=$(auth0 roles create \
  --name "Workshop User" \
  --description "Can use the whoami tool" \
  --json | jq -r .id)

PIZZA_ORDERER_ROLE=$(auth0 roles create \
  --name "Pizza Orderer" \
  --description "Can use every tool" \
  --json | jq -r .id)

auth0 roles permissions add "$WORKSHOP_USER_ROLE" \
  --api-id "$MCP_AUDIENCE" \
  --permissions "tool:whoami"

auth0 roles permissions add "$PIZZA_ORDERER_ROLE" \
  --api-id "$MCP_AUDIENCE" \
  --permissions "tool:whoami,tool:order_pizza"
```

Check it:

```bash
auth0 roles permissions list "$WORKSHOP_USER_ROLE"
auth0 roles permissions list "$PIZZA_ORDERER_ROLE"
```

### 2.4 Assign roles to a user

Use your own login, and create a second test user if you want to compare both roles side by side.

**Dashboard**

1. Open **Users** in the sidebar. To make a test user, click **Create User**, enter an email and password, choose the `Username-Password-Authentication` connection, and click **Create**.
2. Open the user and go to the **Roles** tab.
3. Click **Assign Roles**, pick the role, and click **Assign**.

You can also do it from the role: open the role, go to its **Users** tab, click **Add Users**, select the users and assign.

**CLI**

```bash
# Create a test user (skip this if you want to use an existing login)
auth0 users create \
  --name "Workshop Tester" \
  --email workshop.tester@example.com \
  --connection-name "Username-Password-Authentication" \
  --password "ChangeMe-Workshop-123!"

# Find a user ID by email
USER_ID=$(auth0 users search --query 'email:"workshop.tester@example.com"' --json | jq -r '.[0].user_id')

# Assign a role
auth0 users roles assign "$USER_ID" --roles "$WORKSHOP_USER_ROLE"
```

Check it:

```bash
auth0 users roles show "$USER_ID"
```

> The password above is throwaway test data for a workshop tenant. Use your own, and don't reuse a real password.

## 3. Try it

Restart the server if it is running, and clear the Inspector's stored OAuth state (**Clear OAuth state** in the web client, or `--relogin` with the CLI). Permissions in the token only appear after a fresh login.

| Signed in as a user with | `whoami`                              | `order_pizza` |
| ------------------------ | ------------------------------------- | ------------- |
| No role                  | Refused                               | Refused       |
| `Workshop User`          | Works, `permissions: ["tool:whoami"]` | Refused       |
| `Pizza Orderer`          | Works                                 | Works         |

A refused call returns:

```
You don't have permission to use the 'order_pizza' tool.
```

Try this flow:

1. Log in as a user with the `Workshop User` role.
2. Call `whoami` and check the `permissions` array.
3. Call `order_pizza` and see it refused.
4. In Auth0, add the `Pizza Orderer` role to the user:

   ```bash
   auth0 users roles assign "$USER_ID" --roles "$PIZZA_ORDERER_ROLE"
   ```

5. Call `order_pizza` again, with no new login. It now works, because the plugin checks live.

To take the role away again, use `auth0 users roles remove "$USER_ID" --roles "$PIZZA_ORDERER_ROLE"`.

## Troubleshooting

| Symptom                                       | Likely cause                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| A tool is still open to everyone              | The `tool:<name>` permission isn't defined on the API (2.1), or the name doesn't match `metadata.name`                  |
| Every tool is refused, even for allowed users | The M2M app lacks `read:resource_servers` or `read:users`, or `CLIENT_ID`/`CLIENT_SECRET` are wrong                     |
| `permissions` is empty in `whoami`            | RBAC or **Add Permissions in the Access Token** is off (2.2), or you haven't logged in again                            |
| A role change doesn't seem to apply           | Check the user has the role directly. Enforcement is live, but `whoami` shows the token's permissions from login time   |
| `roles permissions add` can't find the API    | Pass the API identifier (`$MCP_AUDIENCE`) to `--api-id`, and define the permission on the API first                     |
| Role or sidebar item is missing               | The new navigation moved it. See [Auth0 Dashboard navigation](00-prerequisites.md#auth0-dashboard-navigation)           |

## Checkpoint

Each tool is gated by its own permission, assigned through Auth0 roles. That completes the workshop.
