import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListWorkOrders,
  getListWorkOrdersQueryKey,
  useCreateWorkOrder,
  useGetDuesStripeConfigured,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, PageContent } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Wrench,
  CreditCard,
  Vote,
  Megaphone,
  FileText,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  createdAt?: string;
}

const categoryColors: Record<string, { bg: string; text: string; dot: string }> = {
  governance: { bg: "bg-indigo-50/70 dark:bg-indigo-950/30", text: "text-indigo-900 dark:text-indigo-300", dot: "bg-indigo-900" },
  maintenance: { bg: "bg-amber-50/70 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  general: { bg: "bg-stone-50 dark:bg-stone-900/50", text: "text-stone-700 dark:text-stone-300", dot: "bg-stone-500" },
  emergency: { bg: "bg-red-50/70 dark:bg-red-950/30", text: "text-red-700 dark:text-red-300", dot: "bg-red-600" },
  event: { bg: "bg-amber-50/50 dark:bg-amber-950/20", text: "text-amber-800 dark:text-amber-400", dot: "bg-amber-600" },
};

export default function DashboardPage() {
  const { resident } = useAuth();
  const [, setLocation] = useLocation();

  if (!resident) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [woOpen, setWoOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "plumbing", priority: "medium", description: "" });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);

  const { data: workOrders } = useListWorkOrders({ query: { queryKey: getListWorkOrdersQueryKey() } });
  const { data: stripeConfig } = useGetDuesStripeConfigured();

  const myWorkOrders = workOrders?.filter((wo) => wo.resident_name === resident?.name) ?? [];
  const activeWorkOrders = myWorkOrders.filter((wo) => wo.status === "open" || wo.status === "in_progress");

  const API_BASE_URL = import.meta.env.VITE_API_URL || "https://beyond-hoa-web-production.up.railway.app";

  const fetchAnnouncements = async () => {
    setAnnLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/announcements`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setAnnLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const createWO = useCreateWorkOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkOrdersQueryKey() });
        setWoOpen(false);
        setForm({ title: "", category: "plumbing", priority: "medium", description: "" });
        toast({ title: "Work order submitted" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resident) return;
    createWO.mutate({
      data: {
        title: form.title,
        category: form.category,
        priority: form.priority,
        description: form.description,
        resident_name: resident.name,
        unit: resident.unit,
      },
    });
  };

  const sortedAnnouncements = announcements
    .slice()
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    /* Fix: Updated container layout & scroll padding to prevent overflow gaps */
    <div className="w-full flex flex-col pb-24 md:pb-8">
      <PageHeader
        title={`Welcome, ${resident?.name?.split(" ")[0]}`}
        subtitle={`Unit ${resident?.unit} · ${resident?.status === "owner" ? "Owner" : "Tenant"}`}
      />
      
      {/* Fix: Added flex-none & h-auto to PageContent wrapper */}
      <PageContent className="space-y-6 h-auto flex-none">
        
        {/* 1. Stat Tiles Row (Increased text sizes for mobile) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">

          {/* Dues Status */}
          <div
            onClick={() => setLocation("/dues")}
            data-testid="link-dues"
            className="block group h-full cursor-pointer"
          >
            <Card
              data-testid="card-dues-status"
              className="border-l-4 border-l-red-400 group-hover:shadow-md transition-all h-full"
            >
              <CardContent className="p-2.5 sm:p-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                    Dues
                  </span>
                  <div className="bg-red-50 dark:bg-red-950/40 rounded p-1 shrink-0">
                    <CreditCard className="w-3.5 h-3.5 text-red-500" />
                  </div>
                </div>
                <div>
                  <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">
                    {stripeConfig?.configured ? "$0" : "$155"}
                  </p>
                  <p className="text-[11px] sm:text-xs font-semibold text-red-500 mt-1 truncate">
                    {stripeConfig?.configured ? "Paid" : "Due Mar 30"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Work Orders */}
          <div
            onClick={() => setWoOpen(true)}
            className="block group h-full cursor-pointer"
          >
            <Card
              data-testid="card-my-work-orders"
              className="border-l-4 border-l-amber-500 group-hover:shadow-md transition-all h-full"
            >
              <CardContent className="p-2.5 sm:p-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                    Orders
                  </span>
                  <div className="bg-amber-50 dark:bg-amber-950/40 rounded p-1 shrink-0">
                    <Wrench className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                </div>
                <div>
                  <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">
                    {activeWorkOrders.length}
                  </p>
                  <p className="text-[11px] sm:text-xs font-semibold text-amber-600 mt-1 truncate">
                    Active
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Votes */}
          <div
            onClick={() => setLocation("/voting")}
            data-testid="link-votes"
            className="block group h-full cursor-pointer"
          >
            <Card
              data-testid="card-active-votes"
              className="border-l-4 border-l-blue-500 group-hover:shadow-md transition-all h-full"
            >
              <CardContent className="p-2.5 sm:p-3 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
                    Votes
                  </span>
                  <div className="bg-blue-50 dark:bg-blue-950/40 rounded p-1 shrink-0">
                    <Vote className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                </div>
                <div>
                  <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">
                    1
                  </p>
                  <p className="text-[11px] sm:text-xs font-semibold text-blue-600 mt-1 truncate">
                    Open
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* 2. Quick Actions — Updated 2x2 Grid with Larger Text */}
        <div className="mt-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-3">

            {/* Pay Dues Card */}
            <div
              onClick={() => setLocation("/dues")}
              data-testid="link-pay-dues"
              className="bg-card border rounded-2xl p-3.5 hover:shadow-sm transition-all group cursor-pointer flex flex-col justify-between h-36"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-500 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Pay dues</h4>
                <p className="text-xs text-muted-foreground mt-0.5">$155 due Mar 30</p>
                <span className="inline-block mt-1.5 text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full">
                  Overdue soon
                </span>
              </div>
            </div>

            {/* Report Issue Card */}
            <button
              type="button"
              onClick={() => setWoOpen(true)}
              data-testid="link-report-issue"
              className="bg-card border rounded-2xl p-3.5 hover:shadow-sm transition-all group cursor-pointer flex flex-col justify-between h-36 text-left w-full"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Wrench className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Report issue</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Submit a work order</p>
              </div>
            </button>

            {/* Documents Card */}
            <div
              onClick={() => setLocation("/documents")}
              data-testid="link-documents"
              className="bg-card border rounded-2xl p-3.5 hover:shadow-sm transition-all group cursor-pointer flex flex-col justify-between h-36"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-500 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Documents</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Bylaws & guidelines</p>
              </div>
            </div>

            {/* Contact Board Card */}
            <a
              href="mailto:board@beyondhoa.com"
              data-testid="link-contact-board"
              className="bg-card border rounded-2xl p-3.5 hover:shadow-sm transition-all group cursor-pointer flex flex-col justify-between h-36"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Contact board</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Message administrators</p>
              </div>
            </a>

          </div>
        </div>

        {/* 3. Community Announcements (Scaled text sizes) */}
        <Card className="border-t-2 border-t-amber-500 mt-4">
          <CardHeader className="pb-2 pt-3 px-3.5">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-amber-800 dark:text-amber-400">
              <Megaphone className="w-4 h-4 text-amber-600/70 shrink-0" />
              <span className="truncate">Community Announcements</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 px-3.5 pb-3.5">
            {annLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : sortedAnnouncements.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Megaphone className="w-7 h-7 mx-auto mb-2 opacity-40" />
                <p className="text-xs sm:text-sm">No announcements posted yet.</p>
              </div>
            ) : (
              sortedAnnouncements.map((announcement) => {
                const colors = categoryColors[announcement.category] || categoryColors.general;
                return (
                  <div
                    key={announcement.id}
                    className="flex items-start gap-2.5 p-3 rounded-xl border bg-card hover:bg-stone-50/50 transition-colors"
                  >
                    <div className={`rounded-lg p-1.5 w-fit shrink-0 mt-0.5 ${colors.bg}`}>
                      <Megaphone className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1.5">
                        <h4 className="font-semibold text-xs sm:text-sm tracking-tight text-slate-900 dark:text-slate-100 truncate">
                          {announcement.title}
                        </h4>
                        <div className="flex items-center gap-1 shrink-0">
                          {announcement.pinned && (
                            <Badge className="text-[9px] px-1 py-0 uppercase tracking-wider font-bold bg-amber-500 hover:bg-amber-600 text-white border-0">
                              Pin
                            </Badge>
                          )}
                          <span className="text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap">
                            {announcement.createdAt
                              ? new Date(announcement.createdAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "2-digit",
                                })
                              : "Recent"}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                        {announcement.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

      </PageContent>

      {/* Work Order Dialog */}
      <Dialog open={woOpen} onOpenChange={setWoOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Submit Work Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="wo-title">Title</Label>
              <Input
                id="wo-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Brief description of the issue"
                required
                data-testid="input-wo-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger data-testid="select-wo-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="electrical">Electrical</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="landscaping">Landscaping</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger data-testid="select-wo-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-desc">Description</Label>
              <Textarea
                id="wo-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the issue in detail..."
                rows={3}
                required
                data-testid="input-wo-description"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-indigo-950 hover:bg-indigo-900 text-white"
              disabled={createWO.isPending}
              data-testid="button-submit-wo"
            >
              {createWO.isPending ? "Submitting..." : "Submit Work Order"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}