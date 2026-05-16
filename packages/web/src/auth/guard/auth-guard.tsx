import { useEffect, useState } from "react";
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
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!authenticated) {
      const params = new URLSearchParams({ returnTo: location.pathname });
      navigate(`${CONFIG.auth.signInPath}?${params.toString()}`, {
        replace: true,
      });
      return;
    }
    setIsChecking(false);
  }, [authenticated, loading, location.pathname, navigate]);

  if (isChecking) return <Splash />;

  return <>{children}</>;
}
