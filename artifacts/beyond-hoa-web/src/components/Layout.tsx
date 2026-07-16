import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home,
  FileText,
  CreditCard,
  Vote,
  Users,
  ShieldAlert,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo"; 

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { resident, logout } = useAuth();

  // Determine if the logged-in user is a board member
  const normalizedUserRole = (resident?.notes ?? "").trim().toLowerCase();
  const authorizedBoardRoles = ["president", "treasurer", "secretary", "board member", "board"];
  const isBoardUser = authorizedBoardRoles.includes(normalizedUserRole);

  // Generate dynamic navigation items based on user role
  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/dues", label: "Dues & Payments", icon: CreditCard },
    { href: "/voting", label: "Voting", icon: Vote },
    { href: "/residents", label: "Residents", icon: Users },
    ...(isBoardUser ? [{ href: "/board", label: "Board Portal", icon: ShieldAlert }] : []),
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Dark Sidebar matched to match your custom deep Indigo theme */}
      <aside className="w-64 flex-shrink-0 bg-indigo-950 flex flex-col shadow-xl border-r border-indigo-900/40">
        <div className="p-5 border-b border-indigo-900/60">
          {/* Custom Styled Responsive Vector Logo */}
          <Logo className="h-10 w-auto" showText={true} />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (location && typeof location === 'string' && location.startsWith(item.href + "/"));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-indigo-100 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-indigo-200" />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60 text-white" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer with Session Management */}
        <div className="p-3 border-t border-indigo-900/60">
          <div className="px-3 py-2 mb-2">
            <p className="text-white text-sm font-medium truncate">{resident?.name}</p>
            <p className="text-indigo-200 text-sm truncate">
              {isBoardUser ? `${resident?.notes} · Unit ${resident?.unit}` : `Unit ${resident?.unit}`}
            </p>
          </div>
          <button
            onClick={logout}
            data-testid="button-logout"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-100 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            <LogOut className="w-4 h-4 text-indigo-200" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

// Layout helper layouts used throughout other sub-pages
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between px-8 pt-8 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function PageContent({ children }: { children: React.ReactNode }) {
  return <div className="px-8 pb-8">{children}</div>;
}
