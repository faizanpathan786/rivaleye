import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, queryPersister, QUERY_CACHE_MAX_AGE } from "./lib/query-client";
import { AppShell } from "./components/layout/app-shell";
import { DashboardPage } from "./routes/dashboard";
// RadarPage (./routes/radar) is built but parked behind a coming-soon screen
// for launch — keep the file; do not delete.
import { RadarComingSoonPage } from "./routes/radar-soon";
import { CompetitorsPage } from "./routes/competitors";
import { ScanPage } from "./routes/scan";
import { ComparePage } from "./routes/compare";
import { FounderPage } from "./routes/founder";
import { ProductPage } from "./routes/product";
import { MarketingPage } from "./routes/marketing";
import { GrowthPage } from "./routes/growth";
import { HistoryPage } from "./routes/history";
import { ReportPage } from "./routes/report";
import { ReportSectionsPage } from "./routes/report-sections";
import { ScanReportPage } from "./routes/scan-report";
import { AccountPage } from "./routes/account";
import { BillingPage } from "./routes/billing";
import { PlannedActionsPage } from "./routes/planned-actions";
import { PainOppsPage } from "./routes/pain-opps";
import { SignInPage } from "./routes/signin";
import { NotFoundPage } from "./routes/not-found";
import { AuthProvider } from "./auth/context/better-auth";
import { AuthGuard, GuestGuard } from "./auth/guard";
import { Toaster } from "@/components/ui/sonner";

function protect(Component: React.ComponentType) {
  return () => (
    <AuthGuard>
      <Component />
    </AuthGuard>
  );
}

const router = createBrowserRouter([
  {
    path: "/signin",
    Component: () => (
      <GuestGuard>
        <SignInPage />
      </GuestGuard>
    ),
  },
  {
    path: "/",
    Component: () => (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      { index: true, Component: DashboardPage },
      { path: "dashboard", Component: DashboardPage },
      { path: "radar", Component: RadarComingSoonPage },
      { path: "competitors", Component: CompetitorsPage },
      { path: "scan", Component: ScanPage },
      { path: "compare", Component: ComparePage },
      { path: "founder", Component: FounderPage },
      { path: "product", Component: ProductPage },
      { path: "marketing", Component: MarketingPage },
      { path: "growth", Component: GrowthPage },
      { path: "history", Component: HistoryPage },
      { path: "reports/:id", Component: ReportPage },
      { path: "reports/:id/sections", Component: ReportSectionsPage },
      { path: "scan-report", Component: ScanReportPage },
      { path: "scan-report/:id", Component: ScanReportPage },
      { path: "scan-report/:id/:lens", Component: ScanReportPage },
      { path: "account", Component: AccountPage },
      { path: "billing", Component: BillingPage },
      { path: "my-plan", Component: PlannedActionsPage },
      { path: "pain-opps", Component: PainOppsPage },
    ],
  },
  { path: "*", Component: NotFoundPage },
]);

void protect;

export function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: QUERY_CACHE_MAX_AGE,
        dehydrateOptions: {
          // Persist only successful queries, and never the current user's
          // profile ("me") — keep PII out of localStorage.
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" && query.queryKey[0] !== "me",
        },
      }}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="bottom-right" />
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
