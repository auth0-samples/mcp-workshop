# Step 4: Per-tool permissions

Branch: `step-4-tool-permissions`

Restrict each tool to the users who hold the matching Auth0 permission. This is built into the `@xmcp-dev/auth0` plugin, so almost everything in this step is Auth0 configuration.

```bash
git diff step-3-add-client step-4-tool-permissions
```

## What changes

| File                         | Change                                           |
| ---------------------------- | ------------------------------------------------ |
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

`permissions` is read from the token's `permissions` claim. It only appears when the API has RBAC enabled and permissions are added to the access token (step 2 below). The plugin's enforcement doesn't depend on it, because it asks the Management API, but it is the quickest way to see what a user holds.

## 2. Auth0 setup

### 2.1 Define the permissions on the API

**Applications > APIs > MCP Tools API > Permissions**, add:

| Permission         | Description              |
| ------------------ | ------------------------ |
| `tool:whoami`      | Access the whoami tool   |
| `tool:order_pizza` | Access the order_pizza tool |

The moment a permission exists here, the matching tool stops being public.

### 2.2 Enable RBAC and put permissions in the token

**Applications > APIs > MCP Tools API > Settings > RBAC Settings**, turn on both and save:

- **Enable RBAC**
- **Add Permissions in the Access Token**

### 2.3 Create roles

**User Management > Roles > Create Role**, then open each role's **Permissions** tab and add permissions from `MCP Tools API`:

| Role            | Permissions                        |
| --------------- | ---------------------------------- |
| `Workshop User` | `tool:whoami`                      |
| `Pizza Orderer` | `tool:whoami`, `tool:order_pizza`  |

### 2.4 Assign users to roles

Open each role's **Users** tab and add users. Create a second test user if you want to compare both roles side by side.

### The same with the Auth0 CLI

```bash
auth0 roles create --name "Workshop User" --description "Can use the whoami tool"
auth0 roles create --name "Pizza Orderer" --description "Can use every tool"

auth0 roles permissions add ROLE_ID_WORKSHOP_USER --api-id "http://localhost:3001/" --permissions "tool:whoami"
auth0 roles permissions add ROLE_ID_PIZZA_ORDERER --api-id "http://localhost:3001/" --permissions "tool:whoami,tool:order_pizza"

auth0 users roles assign "USER_ID" --roles "ROLE_ID"
```

Defining the permissions on the API itself (2.1) and enabling RBAC (2.2) is easiest from the Dashboard. If you prefer the CLI, you can set `"enforce_policies": true` and `"token_dialect": "rfc9068_profile_authz"` on the resource server, which puts the `permissions` claim in the access token.

## 3. Try it

Restart the server if it is running, and clear the Inspector's stored OAuth state (**Clear OAuth state** in the web client, or `--relogin` with the CLI). Permissions in the token only appear after a fresh login.

| Signed in as a user with       | `whoami`                                  | `order_pizza`                          |
| ------------------------------ | ----------------------------------------- | -------------------------------------- |
| No role                        | Refused                                   | Refused                                |
| `Workshop User`                | Works, `permissions: ["tool:whoami"]`     | Refused                                |
| `Pizza Orderer`                | Works                                     | Works                                  |

A refused call returns:

```
You don't have permission to use the 'order_pizza' tool.
```

Try this flow:

1. Log in as a user with the `Workshop User` role.
2. Call `whoami` and check the `permissions` array.
3. Call `order_pizza` and see it refused.
4. In Auth0, add the `Pizza Orderer` role to the user.
5. Call `order_pizza` again, with no new login. It now works, because the plugin checks live.

## Troubleshooting

| Symptom                                        | Likely cause                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A tool is still open to everyone               | The `tool:<name>` permission isn't defined on the API, or the name doesn't match `metadata.name` |
| Every tool is refused, even for allowed users  | The M2M app lacks `read:resource_servers` or `read:users`, or `CLIENT_ID`/`CLIENT_SECRET` are wrong |
| `permissions` is empty in `whoami`             | RBAC or **Add Permissions in the Access Token** is off, or you haven't logged in again          |
| A role change doesn't seem to apply            | Check the user has the role directly. Enforcement is live, but `whoami` shows the token's permissions from login time |

## Checkpoint

Each tool is gated by its own permission, assigned through Auth0 roles. That completes the workshop.
