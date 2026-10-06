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
