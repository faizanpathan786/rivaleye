import { useCallback, useMemo } from "react";
import { authClient } from "@/lib/auth-client";
import { AuthContext } from "../auth-context";

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const session = authClient.useSession();

  const user = session.data?.user ?? null;
  const loading = session.isPending;

  const checkUserSession = useCallback(async () => {
    await authClient.getSession();
  }, []);

  const status = loading
    ? "loading"
    : user
      ? "authenticated"
      : "unauthenticated";

  const value = useMemo(
    () => ({
      user,
      checkUserSession,
      loading: status === "loading",
      authenticated: status === "authenticated",
      unauthenticated: status === "unauthenticated",
    }),
    [user, checkUserSession, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
