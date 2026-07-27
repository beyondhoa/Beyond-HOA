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
<<<<<<< HEAD
  ChevronRight
=======
  Mail,
>>>>>>> 0658660 (Update dashboard layout and PWA configuration)
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
    <div className="flex-1 flex flex-col w-full h-full">
      <PageHeader
        title={`Welcome, ${resident?.name?.split(" ")[0]}`}
        subtitle={`Unit ${resident?.unit} · ${resident?.status === "owner" ? "Owner" : "Tenant"}`}
      />
<<<<<<< HEAD
      <PageContent className="space-y-6">
        
        {/* 1. Stat Tiles Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Tile 1: Dues Status -> Links to /dues */}
          <a href="/dues" className="block group">
            <Card data-testid="card-dues-status" className="border-l-4 border-l-stone-400 group-hover:shadow-md group-hover:scale-[1.01] transition-all cursor-pointer h-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="bg-stone-100 rounded-xl p-3">
                    <CreditCard className="w-5 h-5 text-stone-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground font-medium">Dues Status</p>
                    <p className="text-xl font-bold text-slate-900">
                      {stripeConfig?.configured ? "Paid" : "Setup Needed"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>
=======
      <div className="flex-1 flex flex-col w-full space-y-4">
        <PageContent>
>>>>>>> 0658660 (Update dashboard layout and PWA configuration)

          {/* 1. Stat Tiles Row */}
          <div className="grid grid-cols-3 gap-2 w-full">

            {/* Dues Status */}
            <div
              onClick={() => setLocation("/dues")}
              data-testid="link-dues"
              className="block group h-full cursor-pointer"
            >
              <Card
                data-testid="card-dues-status"
                className="border-l-4 border-l-red-400 group-hover:shadow-md group-hover:scale-[1.01] transition-all h-full"
              >
                <CardContent className="p-2">
                  <div className="bg-red-50 rounded-md p-1 w-fit mb-1">
                    <CreditCard className="w-3 h-3 text-red-500" />
                  </div>
                  <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5 truncate">Dues</p>
                  <p className="text-base font-bold text-slate-900 leading-none">
                    {stripeConfig?.configured ? "$0" : "$155"}
                  </p>
                  <p className="text-[10px] font-semibold text-red-500 mt-0.5 truncate">
                    {stripeConfig?.configured ? "Paid" : "Due Mar 30"}
                  </p>
                </CardContent>
              </Card>
<<<<<<< HEAD
            </DialogTrigger>
            
            <DialogContent>
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
                <Button type="submit" className="w-full bg-indigo-950 hover:bg-indigo-900 text-white" disabled={createWO.isPending} data-testid="button-submit-wo">
                  {createWO.isPending ? "Submitting..." : "Submit Work Order"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Tile 3: Active Votes -> Links to /voting */}
          <a href="/voting" className="block group">
            <Card data-testid="card-active-votes" className="border-l-4 border-l-indigo-900 group-hover:shadow-md group-hover:scale-[1.01] transition-all cursor-pointer h-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-50 rounded-xl p-3">
                    <Vote className="w-5 h-5 text-indigo-900" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground font-medium">Active Votes</p>
                    <p className="text-xl font-bold text-slate-900">1 Open</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </a>

        </div>

        {/* 2. Quick Actions Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Contact Board Card */}
          <a href="mailto:board@beyondhoa.com" className="flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-stone-50/50 hover:border-stone-300 hover:shadow-md hover:scale-[1.01] transition-all font-semibold text-base text-indigo-950 group">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                <Megaphone className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900">Contact Board</p>
                <p className="text-sm text-muted-foreground font-normal">Message the administrators</p>
              </div>
=======
            </div>

            {/* Work Orders */}
            <div
              onClick={() => setWoOpen(true)}
              className="block group h-full cursor-pointer"
            >
              <Card
                data-testid="card-my-work-orders"
                className="border-l-4 border-l-amber-500 group-hover:shadow-md group-hover:scale-[1.01] transition-all h-full"
              >
                <CardContent className="p-2">
                  <div className="bg-amber-50 rounded-md p-1 w-fit mb-1">
                    <Wrench className="w-3 h-3 text-amber-600" />
                  </div>
                  <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5 truncate">Orders</p>
                  <p className="text-base font-bold text-slate-900 leading-none">{activeWorkOrders.length}</p>
                  <p className="text-[10px] font-semibold text-amber-600 mt-0.5 truncate">Active</p>
                </CardContent>
              </Card>
>>>>>>> 0658660 (Update dashboard layout and PWA configuration)
            </div>

<<<<<<< HEAD
          {/* Community Documents Card */}
          <a href="/documents" className="flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-stone-50/50 hover:border-stone-300 hover:shadow-md hover:scale-[1.01] transition-all font-semibold text-base text-indigo-950 group">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-900">
                <FileText className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900">Community Documents</p>
                <p className="text-sm text-muted-foreground font-normal">View bylaws & guidelines</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </a>

        </div>
=======
            {/* Active Votes */}
            <div
              onClick={() => setLocation("/voting")}
              data-testid="link-votes"
              className="block group h-full cursor-pointer"
            >
              <Card
                data-testid="card-active-votes"
                className="border-l-4 border-l-blue-500 group-hover:shadow-md group-hover:scale-[1.01] transition-all h-full"
              >
                <CardContent className="p-2">
                  <div className="bg-blue-50 rounded-md p-1 w-fit mb-1">
                    <Vote className="w-3 h-3 text-blue-600" />
                  </div>
                  <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5 truncate">Votes</p>
                  <p className="text-base font-bold text-slate-900 leading-none">1</p>
                  <p className="text-[10px] font-semibold text-blue-600 mt-0.5 truncate">Open</p>
                </CardContent>
              </Card>
            </div>
          </div>
>>>>>>> 0658660 (Update dashboard layout and PWA configuration)

          {/* 2. Quick Actions — Icon Grid */}
          <div className="mt-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Quick Actions
            </p>
            <div className="grid grid-cols-4 gap-1.5">

              {/* Pay Dues */}
              <div
                onClick={() => setLocation("/dues")}
                data-testid="link-pay-dues"
                className="flex flex-col items-center gap-1.5 pt-3 pb-2.5 px-1 bg-card border rounded-xl hover:bg-stone-50/50 hover:border-stone-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-500 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                  <CreditCard className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium text-slate-700 text-center leading-tight truncate w-full text-center">Pay Dues</span>
              </div>

              {/* Documents */}
              <div
                onClick={() => setLocation("/documents")}
                data-testid="link-documents"
                className="flex flex-col items-center gap-1.5 pt-3 pb-2.5 px-1 bg-card border rounded-xl hover:bg-stone-50/50 hover:border-stone-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium text-slate-700 text-center leading-tight truncate w-full text-center">Documents</span>
              </div>

              {/* Report Issue */}
              <button
                type="button"
                onClick={() => setWoOpen(true)}
                data-testid="link-report-issue"
                className="flex flex-col items-center gap-1.5 pt-3 pb-2.5 px-1 bg-card border rounded-xl hover:bg-stone-50/50 hover:border-stone-300 hover:shadow-sm transition-all group cursor-pointer w-full"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-500 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <Wrench className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium text-slate-700 text-center leading-tight truncate w-full text-center">Report Issue</span>
              </button>

              {/* Contact Board */}
              <a
                href="mailto:board@beyondhoa.com"
                data-testid="link-contact-board"
                className="flex flex-col items-center gap-1.5 pt-3 pb-2.5 px-1 bg-card border rounded-xl hover:bg-stone-50/50 hover:border-stone-300 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-green-100 text-green-600 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium text-slate-700 text-center leading-tight truncate w-full text-center">Contact</span>
              </a>
            </div>
          </div>

          {/* 3. Community Announcements */}
          <Card className="border-t-2 border-t-amber-500 mt-4">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                <Megaphone className="w-3.5 h-3.5 text-amber-600/70 shrink-0" />
                <span className="truncate">Community Announcements</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3">
              {annLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : sortedAnnouncements.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Megaphone className="w-7 h-7 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No announcements posted yet.</p>
                </div>
              ) : (
                sortedAnnouncements.map((announcement) => {
                  const colors = categoryColors[announcement.category] || categoryColors.general;
                  return (
                    <div
                      key={announcement.id}
                      className="flex items-start gap-2 p-2.5 rounded-xl border bg-card hover:bg-stone-50/50 transition-colors"
                    >
                      {/* Category icon */}
                      <div className={`rounded-lg p-1.5 w-fit shrink-0 mt-0.5 ${colors.bg}`}>
                        <Megaphone className={`w-3.5 h-3.5 ${colors.text}`} />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-1.5">
                          <h4 className="font-semibold text-xs tracking-tight text-slate-900 truncate">
                            {announcement.title}
                          </h4>
                          <div className="flex items-center gap-1 shrink-0">
                            {announcement.pinned && (
                              <Badge className="text-[9px] px-1 py-0 uppercase tracking-wider font-bold bg-amber-500 hover:bg-amber-600 text-white border-0">
                                Pin
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {announcement.createdAt
                                ? new Date(announcement.createdAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "2-digit",
                                  })
                                : "Recent"}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
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
      </div>

      {/* Work Order Dialog */}
      <Dialog open={woOpen} onOpenChange={setWoOpen}>
        <DialogContent className="max-w-[92vw] rounded-2xl">
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