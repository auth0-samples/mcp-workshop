import { type ToolMetadata } from "xmcp";
import { getAuthInfo } from "@xmcp-dev/auth0";

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
