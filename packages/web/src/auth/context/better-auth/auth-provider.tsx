import { useCallback, useEffect, useMemo } from "react";
import { authClient } from "@/lib/auth-client";
import { AuthContext } from "../auth-context";
import {
  clearSessionHint,
  readSessionHint,
  writeSessionHint,
} from "../../session-hint";
import { deriveAuthView } from "../../session-state";

type Props = {
  children: React.ReactNode;
};

function errorStatusOf(error: unknown): number | null {
  if (!error) return null;
  if (typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return 0;
}

export function AuthProvider({ children }: Props) {
  const session = authClient.useSession();
  // Snapshot of the last signed-in user. While the real session is resolving
  // over the network (or a refetch failed transiently), we trust the snapshot
  // so refreshes render instantly instead of blocking on a round-trip.
  // UI-only optimism — every API call still enforces the session cookie.
  const hint = useMemo(
    () => readSessionHint(),
    // Re-read whenever a new resolution starts so a fresh sign-in is seen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.isPending],
  );

  const view = deriveAuthView(
    {
      isPending: session.isPending,
      user: session.data?.user ?? null,
      errorStatus: errorStatusOf(session.error),
    },
    hint,
  );

  const { user, loading, hintAction } = view;

  useEffect(() => {
    if (hintAction === "write") writeSessionHint(user as Record<string, unknown>);
    else if (hintAction === "clear") clearSessionHint();
  }, [hintAction, user]);

  const checkUserSession = useCallback(async () => {
    await authClient.getSession();
  }, []);

  const value = useMemo(
    () => ({
      user,
      checkUserSession,
      loading,
      authenticated: !loading && !!user,
      unauthenticated: !loading && !user,
    }),
    [user, checkUserSession, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
