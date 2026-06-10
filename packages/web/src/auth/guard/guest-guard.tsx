import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { CONFIG } from "@/global-config";
import { useAuthContext } from "../hooks";

type GuestGuardProps = {
  children: React.ReactNode;
};

export function GuestGuard({ children }: GuestGuardProps) {
  const { loading, authenticated } = useAuthContext();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const returnTo = searchParams.get("returnTo") || CONFIG.auth.redirectPath;
  const justSignedOut =
    (location.state as { signedOut?: boolean } | null)?.signedOut === true;

  useEffect(() => {
    // Don't bounce an authenticated visitor away mid sign-out — the session is
    // being torn down in the background and this view should stay on the form.
    if (!justSignedOut && !loading && authenticated) {
      window.location.href = returnTo;
    }
  }, [authenticated, loading, returnTo, justSignedOut]);

  // Always render the form immediately; no loading splash for guests.
  return <>{children}</>;
}
