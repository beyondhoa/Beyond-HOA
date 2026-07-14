import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home,
  FileText,
  CreditCard,
  MessageSquare,
  Vote,
  Users,
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
    { href: "/dues", label: "Dues & Payments", icon: CreditCard },
    { href: "/voting", label: "Voting", icon: Vote },
    ...(isBoardUser ? [{ href: "/board", label: "Board Portal", icon: ShieldAlert }] : []),
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-64 flex-shrink-0 bg-[#1A6BB5] flex flex-col shadow-xl">
        <div className="p-5 border-b border-[#1C74C0]">
          <div className="flex items-center gap-3">
            <img src={iconUrl} alt="Beyond HOA" className="w-9 h-9 rounded-lg" />
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Beyond HOA</p>
              <p className="text-blue-200 text-xs">Community Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.switchTo ? location.startsWith(item.href + "/") : false;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#1C74C0]">
          <div className="px-3 py-2 mb-2">
            <p className="text-white text-xs font-medium truncate">{resident?.name}</p>
            <p className="text-blue-200 text-xs truncate">
              {isBoardUser ? `${resident?.notes} · Unit ${resident?.unit}` : `Unit ${resident?.unit}`}
            </p>
          </div>
          <button
            onClick={logout}
            data-testid="button-logout"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
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

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between px-8 pt-8 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function PageContent({ children }: { children: React.ReactNode }) {
  return <div className="px-8 pb-8">{children}</div>;
}

export function BuildingIcon() {
  return <Building2 className="w-4 h-4" />;
}
