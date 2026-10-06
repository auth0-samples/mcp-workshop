# Step 1: Start state

Branch: `step-1-start-state`

A barebones [xmcp](https://xmcp.dev) server with two tools. There is no authentication: anyone who can reach the server can call both tools.

```
server/
  package.json
  tsconfig.json
  xmcp.config.ts
  src/tools/
    whoami.ts
    order-pizza.ts
```

## Run it

```bash
cd server
npm install
npm run dev
```

Then follow [Test with the MCP Inspector](00-prerequisites.md#test-with-the-mcp-inspector).

## How xmcp works

xmcp discovers every file in `src/tools/` and registers it as a tool. Each file exports three things:

- `schema`: the tool's arguments, as a map of [zod](https://zod.dev) types
- `metadata`: the tool's name, description and annotations
- a default function: the handler

## `xmcp.config.ts`

```ts
import type { XmcpConfig } from "xmcp";

const config: XmcpConfig = {
  http: {
    port: 3001,
    endpoint: "/mcp",
  },
  paths: {
    tools: "./src/tools",
    prompts: false,
    resources: false,
  },
};

export default config;
```

HTTP transport only, on port 3001 at `/mcp`. Prompts and resources are switched off because the workshop only uses tools.

## `src/tools/whoami.ts`

Reports who is calling. With no auth yet, it can only say "Anonymous".

```ts
import { type ToolMetadata } from "xmcp";

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

export default async function whoami(_params: Record<string, never>, extra: any) {
  const authInfo = extra?.authInfo;

  if (!authInfo) {
    return "Anonymous: no authentication info is attached to this request yet.";
  }

  return JSON.stringify(
    {
      clientId: authInfo.clientId,
      scopes: authInfo.scopes,
      extra: authInfo.extra,
    },
    null,
    2
  );
}
```

## `src/tools/order-pizza.ts`

A harmless action with side effects, which makes it a good tool to restrict by role in step 4.

```ts
import { z } from "zod";
import { type InferSchema, type ToolMetadata } from "xmcp";

export const schema = {
  topping: z
    .enum(["margherita", "funghi", "hawaiian", "veggie"])
    .describe("Which pizza to order"),
  size: z.enum(["small", "medium", "large"]).default("medium").describe("Pizza size"),
};

export const metadata: ToolMetadata = {
  name: "order_pizza",
  description: "Order a (pretend) pizza for the workshop. An action with side effects, ideal for restricting to certain roles.",
  annotations: {
    title: "Order a pizza",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
};

export default async function orderPizza({ topping, size }: InferSchema<typeof schema>) {
  return [
    `One ${size} ${topping} pizza is on its way!`,
    `Order ID: ${crypto.randomUUID()}`,
    `Estimated delivery: 25 minutes`,
  ].join("\n");
}
```

Note that the tool's `metadata.name` is `order_pizza`, with an underscore. That exact name is used for the permission in step 4.

## Checkpoint

Connect with the Inspector, call `whoami` (you get "Anonymous") and call `order_pizza`. Next: [Step 2: Add Auth0 authentication](02-add-auth.md).
