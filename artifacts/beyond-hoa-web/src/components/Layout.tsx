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

  const authorizedBoardRoles = ["President", "Treasurer", "Secretary", "Board Member", "board"];
  const isBoardUser = authorizedBoardRoles.includes(resident?.note ?? "");

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
            const isActive = location === item.href || location.startsWith(item.href + "/");
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
