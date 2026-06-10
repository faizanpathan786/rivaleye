import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CONFIG } from "@/global-config";
import { useAuthContext } from "../hooks";

type AuthGuardProps = {
  children: React.ReactNode;
};

function Splash() {
  return (
    <div className="grid h-screen w-screen place-items-center bg-background text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { authenticated, loading } = useAuthContext();

  useEffect(() => {
    if (loading || authenticated) return;
    const params = new URLSearchParams({ returnTo: location.pathname });
    navigate(`${CONFIG.auth.signInPath}?${params.toString()}`, {
      replace: true,
    });
  }, [authenticated, loading, location.pathname, navigate]);

  // Once the session is known (e.g. right after sign-in, where better-auth has
  // it cached), render children immediately — no splash. The splash only shows
  // while the session is genuinely resolving, or briefly before redirecting an
  // unauthenticated visitor to sign-in.
  if (authenticated) return <>{children}</>;
  return <Splash />;
}
