import { z } from "zod";
import { type InferSchema, type ToolMetadata } from "xmcp";
import { getAuthInfo } from "@xmcp-dev/auth0";

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
  const { user } = getAuthInfo();
  const customer = user.name ?? user.email ?? user.sub;

  return [
    `One ${size} ${topping} pizza is on its way to ${customer}!`,
    `Order ID: ${crypto.randomUUID()}`,
    `Estimated delivery: 25 minutes`,
  ].join("\n");
}
