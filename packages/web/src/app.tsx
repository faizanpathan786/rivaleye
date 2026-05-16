import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./components/layout/app-shell";
import { DashboardPage } from "./routes/dashboard";
import { RadarPage } from "./routes/radar";
import { CompetitorsPage } from "./routes/competitors";
import { ScanPage } from "./routes/scan";
import { ComparePage } from "./routes/compare";
import { HistoryPage } from "./routes/history";
import { ReportPage } from "./routes/report";
import { AccountPage } from "./routes/account";
import { SignInPage } from "./routes/signin";
import { NotFoundPage } from "./routes/not-found";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/signin", Component: SignInPage },
  {
    path: "/",
    Component: AppShell,
    children: [
      { index: true, Component: DashboardPage },
      { path: "radar",       Component: RadarPage },
      { path: "competitors", Component: CompetitorsPage },
      { path: "scan",        Component: ScanPage },
      { path: "compare",     Component: ComparePage },
      { path: "history",     Component: HistoryPage },
      { path: "reports/:id", Component: ReportPage },
      { path: "account",     Component: AccountPage },
    ],
  },
  { path: "*", Component: NotFoundPage },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
