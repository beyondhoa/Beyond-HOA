import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
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
import AssistantPage from "@/pages/assistant";
import VotingPage from "@/pages/voting";
import ResidentsPage from "@/pages/residents";
import BoardPage from "@/pages/board";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { resident, isLoading } = useAuth();
  if (isLoading) return null;
  if (!resident) return <Redirect to="/login" />;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { resident, isLoading } = useAuth();
  if (isLoading) return null;
  if (resident) return <Redirect to="/dashboard" />;
  return <Component />;
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
      <Route path="/assistant">
        <ProtectedRoute component={AssistantPage} />
      </Route>
      <Route path="/voting">
        <ProtectedRoute component={VotingPage} />
      </Route>
      <Route path="/residents">
        <ProtectedRoute component={ResidentsPage} />
      </Route>
      <Route path="/board">
        <ProtectedRoute component={BoardPage} />
      </Route>
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
