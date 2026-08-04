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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  MessageSquare,
  ChevronRight,
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

const categoryColors: Record<string, { bg: string; text: string }> = {
  governance: { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400" },
  maintenance: { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400" },
  general: { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400" },
  emergency: { bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-700 dark:text-red-400" },
  event: { bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400" },
};

export default function DashboardPage() {
  const { resident } = useAuth();
  const [, setLocation] = useLocation();

  if (!resident) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <p className="text-lg text-muted-foreground animate-pulse font-semibold">Loading dashboard...</p>
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
  const activeWorkOrders = myWorkOrders.filter(
    (wo) => (wo.status as string) === "open" || (wo.status as string) === "in_progress"
  );

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
    <div className="w-full relative bg-slate-50/50">
      <PageHeader
        title={`Welcome, ${resident?.name?.split(" ")[0]}`}
        subtitle={`Unit ${resident?.unit} · ${resident?.status === "owner" ? "Owner" : "Tenant"}`}
      />

      <div className="flex-1 flex flex-col w-full space-y-6">
        <PageContent>

          {/* 1. Stat Tiles Row */}
          <div className="grid grid-cols-3 gap-3 w-full">

            {/* Dues Status */}
            <div
              onClick={() => setLocation("/dues")}
              data-testid="link-dues"
              className="block group cursor-pointer"
            >
              <Card
                data-testid="card-dues-status"
                className="border-l-4 border-l-red-400 group-hover:shadow-md transition-all rounded-xl bg-white"
              >
                <CardContent className="p-3.5 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <div className="bg-red-50 rounded-lg p-2.5 w-fit mb-2">
                      <CreditCard className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">DUES</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">
                      {stripeConfig?.configured ? "$0" : "$155"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-red-500 truncate mt-2">
                    {stripeConfig?.configured ? "Paid" : "Due Mar 30"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Work Orders */}
            <div
              onClick={() => setWoOpen(true)}
              className="block group cursor-pointer"
            >
              <Card
                data-testid="card-my-work-orders"
                className="border-l-4 border-l-amber-500 group-hover:shadow-md transition-all rounded-xl bg-white"
              >
                <CardContent className="p-3.5 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <div className="bg-amber-50 rounded-lg p-2.5 w-fit mb-2">
                      <Wrench className="w-5 h-5 text-amber-600" />
                    </div>
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">WORK ORDERS</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">{activeWorkOrders.length}</p>
                  </div>
                  <p className="text-sm font-bold text-amber-600 truncate mt-2">Active</p>
                </CardContent>
              </Card>
            </div>

            {/* Active Votes */}
            <div
              onClick={() => setLocation("/voting")}
              data-testid="link-votes"
              className="block group cursor-pointer"
            >
              <Card
                data-testid="card-active-votes"
                className="border-l-4 border-l-blue-500 group-hover:shadow-md transition-all rounded-xl bg-white"
              >
                <CardContent className="p-3.5 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <div className="bg-blue-50 rounded-lg p-2.5 w-fit mb-2">
                      <Vote className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">VOTES</p>
                    <p className="text-3xl font-black text-slate-900 leading-none">1</p>
                  </div>
                  <p className="text-sm font-bold text-blue-600 truncate mt-2">Open</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 2. Quick Actions — 2x2 Feature Cards */}
          <div className="mt-6">
            <p className="text-sm font-black text-slate-700 uppercase tracking-widest mb-3">
              QUICK ACTIONS
            </p>
            
            <div className="grid grid-cols-2 gap-3.5">

              {/* Pay Dues Card */}
              <div
                onClick={() => setLocation("/dues")}
                data-testid="link-pay-dues"
                className="bg-white border rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-lg bg-red-100 text-red-500 flex items-center justify-center">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Pay dues</h3>
                  <p className="text-sm text-slate-600 mt-1 font-medium">
                    {stripeConfig?.configured ? "$0 due" : "$155 due Mar 30"}
                  </p>
                </div>
                {!stripeConfig?.configured && (
                  <div className="mt-3">
                    <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
                      Overdue soon
                    </span>
                  </div>
                )}
              </div>

              {/* Report Issue Card */}
              <div
                onClick={() => setWoOpen(true)}
                data-testid="link-report-issue"
                className="bg-white border rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Report issue</h3>
                  <p className="text-sm text-slate-600 mt-1 font-medium">Submit a work order</p>
                </div>
              </div>

              {/* Documents Card */}
              <div
                onClick={() => setLocation("/documents")}
                data-testid="link-documents"
                className="bg-white border rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Documents</h3>
                  <p className="text-sm text-slate-600 mt-1 font-medium">Bylaws & guidelines</p>
                </div>
              </div>

              {/* Contact Board Card */}
              <a
                href="mailto:board@beyondhoa.com"
                data-testid="link-contact-board"
                className="bg-white border rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-6 h-6 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Contact board</h3>
                  <p className="text-sm text-slate-600 mt-1 font-medium">Message administrators</p>
                </div>
              </a>

            </div>
          </div>

          {/* 3. Community Announcements */}
          <div className="mt-6">
            <p className="text-sm font-black text-slate-700 uppercase tracking-widest mb-3">
              COMMUNITY ANNOUNCEMENTS
            </p>

            <div className="bg-white border rounded-xl divide-y">
              {annLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : sortedAnnouncements.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">No community announcements posted yet.</p>
                </div>
              ) : (
                sortedAnnouncements.map((announcement) => {
                  const colors = categoryColors[announcement.category] || categoryColors.general;
                  return (
                    <div
                      key={announcement.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}>
                          <Megaphone className={`w-5 h-5 ${colors.text}`} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-base text-slate-900 leading-snug truncate">
                            {announcement.title}
                          </h4>
                          <p className="text-sm text-slate-600 font-medium truncate mt-0.5">
                            {announcement.content}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-500 shrink-0">
                        {announcement.createdAt
                          ? new Date(announcement.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "2-digit",
                            })
                          : "Jul 15"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </PageContent>
      </div>

      {/* Work Order Dialog */}
      <Dialog open={woOpen} onOpenChange={setWoOpen}>
        <DialogContent className="max-w-[92vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Submit Work Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="wo-title" className="text-sm font-bold">Title</Label>
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
                <Label className="text-sm font-bold">Category</Label>
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
                <Label className="text-sm font-bold">Priority</Label>
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
              <Label htmlFor="wo-desc" className="text-sm font-bold">Description</Label>
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
              className="w-full bg-indigo-950 hover:bg-indigo-900 text-white font-bold text-base py-3"
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