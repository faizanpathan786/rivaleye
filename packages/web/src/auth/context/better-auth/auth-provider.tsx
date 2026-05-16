import { useCallback, useEffect, useMemo, useState } from "react";
import { getMe } from "@/api/me";
import { authClient } from "@/lib/auth-client";
import { AuthContext } from "../auth-context";
import type { AuthState } from "../../types";

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const session = authClient.useSession();

  const checkUserSession = useCallback(async () => {
    try {
      const me = await getMe();
      setState({ user: me, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    if (session.isPending) {
      setState((prev) => ({ ...prev, loading: true }));
      return;
    }
    if (session.data?.user) {
      void checkUserSession();
    } else {
      setState({ user: null, loading: false });
    }
  }, [session.isPending, session.data, checkUserSession]);

  const status = state.loading
    ? "loading"
    : state.user
      ? "authenticated"
      : "unauthenticated";

  const value = useMemo(
    () => ({
      user: state.user,
      checkUserSession,
      loading: status === "loading",
      authenticated: status === "authenticated",
      unauthenticated: status === "unauthenticated",
    }),
    [state.user, checkUserSession, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
