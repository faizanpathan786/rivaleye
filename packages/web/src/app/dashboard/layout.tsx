"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, LogOut, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { User, Workspace } from "@rivaleye/shared";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    api
      .get<{ user: User; workspace: Workspace }>("/api/auth/me")
      .then((data) => {
        setUser(data.user);
        setWorkspace(data.workspace);
      })
      .catch(() => router.push("/auth/login"));
  }, [router]);

  async function handleLogout() {
    try {
      await api.post("/api/auth/logout", {});
    } finally {
      router.push("/auth/login");
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-[hsl(var(--sidebar))]">
        {/* Logo */}
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">RivalEye</p>
              <p className="text-[hsl(var(--sidebar-foreground))] text-xs">Competitive Intel</p>
            </div>
          </Link>
        </div>

        <Separator className="bg-white/10" />

        {/* Workspace */}
        {workspace && (
          <div className="px-4 py-3">
            <p className="text-xs text-[hsl(var(--sidebar-foreground))] uppercase tracking-wider font-medium mb-2">
              Workspace
            </p>
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-white/5">
              <div className="w-6 h-6 rounded bg-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-white font-bold">
                  {workspace.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-white font-medium truncate">{workspace.name}</span>
            </div>
          </div>
        )}

        <Separator className="bg-white/10" />

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          <NavLink
            href="/dashboard"
            icon={<LayoutDashboard className="h-4 w-4" />}
            label="Competitors"
            active={pathname === "/dashboard"}
          />
        </nav>

        <Separator className="bg-white/10" />

        {/* User */}
        <div className="p-4 space-y-2">
          {user && (
            <div className="flex items-center gap-3 px-2 py-1.5 rounded-md">
              <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-white font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{user.name}</p>
                <p className="text-xs text-[hsl(var(--sidebar-foreground))] truncate">{user.email}</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-[hsl(var(--sidebar-foreground))] hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-white/10 text-white"
          : "text-[hsl(var(--sidebar-foreground))] hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="flex items-center gap-3">
        {icon}
        {label}
      </span>
      {active && <ChevronRight className="h-3 w-3 opacity-50" />}
    </Link>
  );
}
