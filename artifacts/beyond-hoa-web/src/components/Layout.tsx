import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home,
  FileText,
  CreditCard,
  Vote,
  ShieldAlert,
  LogOut,
  Building2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import iconUrl from "@/assets/icon.png";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { resident, logout } = useAuth();

  const normalizedUserRole = (resident?.notes ?? "").trim().toLowerCase();
  const authorizedBoardRoles = ["president", "treasurer", "secretary", "board member", "board"];
  const isBoardUser = authorizedBoardRoles.includes(normalizedUserRole);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/dues", label: "Dues", icon: CreditCard },
    { href: "/voting", label: "Voting", icon: Vote },
    ...(isBoardUser ? [{ href: "/board", label: "Board", icon: ShieldAlert }] : []),
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden select-none">
      
      {/* 1. MOBILE TOP HEADER (Hidden on Desktop) */}
      <header className="flex-none h-14 bg-indigo-950 px-4 flex items-center justify-between border-b border-indigo-900/60 shadow-md md:hidden z-30">
        <div className="flex items-center gap-2.5">
          <img src={iconUrl} alt="Beyond HOA" className="w-7 h-7 rounded-lg" />
          <span className="text-white font-semibold text-sm">Beyond HOA</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-indigo-200 text-xs truncate max-w-[120px]">
            {resident?.name}
          </span>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="p-1.5 text-indigo-200 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. DESKTOP SIDEBAR (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 flex-shrink-0 bg-indigo-950 flex-col shadow-xl border-r border-indigo-900/40">
        <div className="p-5 border-b border-indigo-900/60">
          <div className="flex items-center gap-3">
            <img src={iconUrl} alt="Beyond HOA" className="w-9 h-9 rounded-lg" />
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Beyond HOA</p>
              <p className="text-indigo-200 text-sm">Community Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              (typeof location === "string" && location.startsWith(item.href + "/"));
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

      {/* 3. MAIN SCROLLABLE CONTENT */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="min-h-full">
          {children}
        </div>
      </main>

      {/* 4. MOBILE BOTTOM TAB BAR (Hidden on Desktop) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-indigo-950 border-t border-indigo-900/60 flex items-center justify-around z-40 md:hidden pb-[env(safe-area-inset-bottom)] shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location === item.href ||
            (typeof location === "string" && location.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-150",
                isActive
                  ? "text-white font-semibold"
                  : "text-indigo-200/70 hover:text-white"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-indigo-200/70")} />
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-[64px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between px-4 sm:px-8 pt-4 sm:pt-8 pb-4 sm:pb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function PageContent({ children }: { children: React.ReactNode }) {
  return <div className="px-4 sm:px-8 pb-8">{children}</div>;
}

export function BuildingIcon() {
  return <Building2 className="w-4 h-4" />;
}
