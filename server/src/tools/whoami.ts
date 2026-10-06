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
