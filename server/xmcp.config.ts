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
