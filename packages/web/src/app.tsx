import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomePage } from "./routes/home";
import { ReportPage } from "./routes/report";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", Component: HomePage },
  { path: "/reports/:id", Component: ReportPage },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
