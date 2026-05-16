import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CONFIG } from "@/global-config";
import { useAuthContext } from "../hooks";

type GuestGuardProps = {
  children: React.ReactNode;
};

function Splash() {
  return (
    <div className="grid h-screen w-screen place-items-center bg-background text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

export function GuestGuard({ children }: GuestGuardProps) {
  const { loading, authenticated } = useAuthContext();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || CONFIG.auth.redirectPath;
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (authenticated) {
      window.location.href = returnTo;
      return;
    }
    setIsChecking(false);
  }, [authenticated, loading, returnTo]);

  if (isChecking) return <Splash />;

  return <>{children}</>;
}
