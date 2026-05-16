import { createAuthClient } from "better-auth/react";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export const authClient = createAuthClient({
  baseURL: `${baseURL}/v1/auth`,
});

export const { signIn, signUp, signOut, useSession } = authClient;
