import { useEffect } from 'react';
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import DocumentsPage from "@/pages/documents";
import DuesPage from "@/pages/dues";
import VotingPage from "@/pages/voting";
import ResidentsPage from "@/pages/residents";
import BoardPage from "@/pages/board";
import BoardViolationsPage from "@/pages/board/violations";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function LoadingFallback() {
  return (
    <div className="flex min-h-full w-full items-center justify-center bg-background text-foreground p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-950 border-t-transparent" />
        <p className="text-xs font-mono text-muted-foreground">Loading Beyond HOA...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { resident, isLoading } = useAuth();
  if (isLoading) return <LoadingFallback />;
  if (!resident) return <Redirect to="/login" />;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { resident, isLoading } = useAuth();
  if (isLoading) return <LoadingFallback />;
  if (resident) return <Redirect to="/dashboard" />;
  return <Component />;
}

function BoardRoute({ component: Component }: { component: React.ComponentType }) {
  const { resident, isLoading } = useAuth();

  if (isLoading) return <LoadingFallback />;
  if (!resident) return <Redirect to="/login" />;

  const normalizedUserRole = (resident.notes ?? "").trim().toLowerCase();
  const authorizedBoardRoles = ["president", "treasurer", "secretary", "board member", "board"];
  const hasAccess = authorizedBoardRoles.includes(normalizedUserRole);

  if (!hasAccess) return <Redirect to="/dashboard" />;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute component={LoginPage} />
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/documents">
        <ProtectedRoute component={DocumentsPage} />
      </Route>
      <Route path="/dues">
        <ProtectedRoute component={DuesPage} />
      </Route>
      <Route path="/voting">
        <ProtectedRoute component={VotingPage} />
      </Route>
      <Route path="/board/residents">
        <BoardRoute component={ResidentsPage} />
      </Route>
      <Route path="/board/violations">
        <BoardRoute component={BoardViolationsPage} />
      </Route>
      <Route path="/board">
        <BoardRoute component={BoardPage} />
      </Route>

      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/:rest*" component={NotFound} />
    </Switch>
  );
}

export default function App() {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter hook={useHashLocation}>
            <div className="h-full w-full flex flex-col bg-background text-foreground">
              <Router />
            </div>
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}