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
    // Outer container centers the mobile app frame on wider viewports
    <div className="min-h-screen w-full bg-slate-950 flex justify-center items-center select-none">
      
      {/* Mobile Shell Frame */}
      <div className="w-full max-w-md h-screen flex flex-col bg-background relative shadow-2xl overflow-hidden border-x border-indigo-950/40">
        
        {/* TOP HEADER */}
        <header className="flex-none h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-indigo-950 px-4 flex items-center justify-between border-b border-indigo-900/60 shadow-md z-30">
          <div className="flex items-center gap-3">
            <img src={iconUrl} alt="Beyond HOA" className="w-8 h-8 rounded-lg" />
            <div className="flex flex-col">
              <span className="text-white font-bold text-base leading-tight">Beyond HOA</span>
              <span className="text-indigo-200 text-xs font-medium">
                Hi, {resident?.name?.split(' ')[0]} · Unit {resident?.unit}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isBoardUser && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-900/80 text-white rounded-full text-xs font-semibold border border-indigo-700/50">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Board
              </div>
            )}
            <button
              onClick={logout}
              aria-label="Sign out"
              className="p-2 text-indigo-200 hover:text-white rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* MAIN SCROLLABLE CONTENT AREA */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-24 bg-background text-foreground">
          <div className="flex-1 flex flex-col w-full h-auto">
            {children}
          </div>
        </main>

        {/* PERSISTENT MOBILE BOTTOM TAB BAR */}
        <nav className="absolute bottom-0 left-0 right-0 h-[calc(4.25rem+env(safe-area-inset-bottom))] bg-indigo-950 border-t border-indigo-900/60 flex items-center justify-around z-50 pb-[env(safe-area-inset-bottom)] shadow-lg">
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
                  "flex flex-col items-center justify-center flex-1 h-full py-1.5 transition-all duration-150",
                  isActive
                    ? "text-white font-bold"
                    : "text-indigo-200/70 hover:text-white"
                )}
              >
                <Icon className={cn("w-6 h-6", isActive ? "text-white" : "text-indigo-200/70")} />
                <span className="text-xs mt-1 font-medium tracking-tight truncate max-w-[68px]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

      </div>
    </div>
  );
}

export function PageHeader({ 
  title, 
  subtitle, 
  action 
}: { 
  title: string; 
  subtitle?: React.ReactNode; 
  action?: React.ReactNode 
}) {
  return (
    <div className="flex items-start justify-between px-4 pt-5 pb-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground truncate">{title}</h1>
        {subtitle && (
          <div className="mt-1 text-sm font-medium text-muted-foreground truncate">
            {subtitle}
          </div>
        )}
      </div>
      {action && <div className="shrink-0 ml-2">{action}</div>}
    </div>
  );
}

export function PageContent({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string 
}) {
  return <div className={cn("px-4 pb-6", className)}>{children}</div>;
}

export function BuildingIcon() {
  return <Building2 className="w-5 h-5" />;
}