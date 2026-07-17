import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CONFIG } from "@/global-config";
import { useAuthContext } from "../hooks";

type GuestGuardProps = {
  children: React.ReactNode;
};

export function GuestGuard({ children }: GuestGuardProps) {
  const { loading, authenticated } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const rawReturnTo = searchParams.get("returnTo") || CONFIG.auth.redirectPath;
  // Only allow same-app relative paths — and SPA-navigate instead of a full
  // page reload, which would re-bootstrap the bundle and re-resolve the
  // session. Reject protocol-relative ("//"), backslash ("/\"), and any path
  // embedding a "://" that could be interpreted as an absolute URL.
  const returnTo =
    rawReturnTo.startsWith("/") &&
    !rawReturnTo.startsWith("//") &&
    !rawReturnTo.startsWith("/\\") &&
    !rawReturnTo.includes("://")
      ? rawReturnTo
      : CONFIG.auth.redirectPath;
  const justSignedOut =
    (location.state as { signedOut?: boolean } | null)?.signedOut === true;

  useEffect(() => {
    // Don't bounce an authenticated visitor away mid sign-out — the session is
    // being torn down in the background and this view should stay on the form.
    if (!justSignedOut && !loading && authenticated) {
      navigate(returnTo, { replace: true });
    }
  }, [authenticated, loading, returnTo, justSignedOut, navigate]);

  // Always render the form immediately; no loading splash for guests.
  return <>{children}</>;
}
