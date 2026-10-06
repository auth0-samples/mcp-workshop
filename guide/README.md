# Workshop guide

Work through the steps in order. Every step is a branch, and each step's guide lists exactly which files change, so you can follow along or just check out the branch.

| Step | Branch                    | Guide                                                 |
| ---- | ------------------------- | ----------------------------------------------------- |
| 0    | any                       | [Prerequisites and tooling](00-prerequisites.md)      |
| 1    | `step-1-start-state`      | [Start state](01-start-state.md)                      |
| 2    | `step-2-add-auth`         | [Add Auth0 authentication](02-add-auth.md)            |
| 3    | `step-3-add-client`       | [Add the client and CIMD file](03-add-client-cimd.md) |
| 4    | `step-4-tool-permissions` | [Per-tool permissions](04-tool-permissions.md)        |

## Moving between steps

```bash
git checkout step-2-add-auth
```

To see what a step changed compared to the previous one:

```bash
git diff step-1-start-state step-2-add-auth
```

Your `.env` file is ignored by git, so it stays in place when you switch branches. Run `npm install` in `server/` after switching, because the dependencies change in step 2.

## The big picture

```
MCP client (Inspector)  --OAuth-->  Auth0 (authorization server)
        |                                   |
        | Bearer access token               | issues token for audience http://localhost:3001/
        v                                   |
MCP server (xmcp + @xmcp-dev/auth0)  <------+ verifies JWT, checks tool:<name> permission
```

- **Step 2:** the server rejects requests without a valid Auth0 access token and tells clients where to log in.
- **Step 3:** the client identifies itself to Auth0 with a hosted CIMD file instead of dynamic registration.
- **Step 4:** Auth0 roles and permissions decide which tools a user can call.
