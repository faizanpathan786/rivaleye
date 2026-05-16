import { createAuthClient } from "better-auth/react";
import { CONFIG } from "@/global-config";

export const authClient = createAuthClient({
  baseURL: `${CONFIG.serverUrl}/v1/auth`,
});

export const { signIn, signUp, signOut, useSession } = authClient;
