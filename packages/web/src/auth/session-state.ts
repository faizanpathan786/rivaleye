import type { UserType } from "./types";

type SessionLike = {
  isPending: boolean;
  user: UserType;
  /** null = no error; 0 = network-level failure with no HTTP status */
  errorStatus: number | null;
};

export type AuthView = {
  user: UserType;
  loading: boolean;
  hintAction: "write" | "clear" | "keep";
};

// A missing session is only "signed out" when the server said so — a
// successful null response or a 401. Anything else (network blip, 5xx,
// aborted refetch) must not log the user out of the UI or drop the cached
// hint, otherwise the next refresh blocks on the splash again.
export function deriveAuthView(session: SessionLike, hint: UserType): AuthView {
  if (session.user) {
    return { user: session.user, loading: false, hintAction: "write" };
  }
  if (session.isPending) {
    return { user: hint, loading: !hint, hintAction: "keep" };
  }
  const definitelySignedOut =
    session.errorStatus === null || session.errorStatus === 401;
  if (definitelySignedOut) {
    return { user: null, loading: false, hintAction: "clear" };
  }
  return { user: hint, loading: false, hintAction: "keep" };
}
