import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListWorkOrders,
  getListWorkOrdersQueryKey,
  useListViolations,
  getListViolationsQueryKey,
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
  DialogTrigger,
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
  AlertTriangle, 
  Wrench, 
  CreditCard, 
  Plus, 
  Clock, 
  Vote, 
  FileText, 
  Megaphone 
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

const categoryColors: Record<string, { bg: string, text: string, dot: string }> = {
  governance: { bg: 'bg-indigo-50/70 dark:bg-indigo-950/30', text: 'text-indigo-900 dark:text-indigo-300', dot: 'bg-indigo-900' },
  maintenance: { bg: 'bg-amber-50/70 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  general: { bg: 'bg-stone-50 dark:bg-stone-900/50', text: 'text-stone-700 dark:text-stone-300', dot: 'bg-stone-500' },
  emergency: { bg: 'bg-red-50/70 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-600' },
  event: { bg: 'bg-amber-50/50 dark:bg-amber-950/20', text: 'text-amber-800 dark:text-amber-400', dot: 'bg-amber-600' },
};

function statusColor(status: string) {
  switch (status) {
    case "open": return "bg-amber-50 text-amber-800 border-amber-200";
    case "in_progress": return "bg-indigo-50 text-indigo-900 border-indigo-200/50";
    case "completed": return "bg-stone-100 text-stone-800 border-stone-200";
    case "resolved": return "bg-stone-100 text-stone-800 border-stone-200";
    default: return "bg-stone-50 text-stone-600 border-stone-200";
  }
}

export default function DashboardPage() {
  const { resident } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "plumbing", priority: "medium", description: "" });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);

  const { data: workOrders, isLoading: woLoading } = useListWorkOrders({ query: { queryKey: getListWorkOrdersQueryKey() } });
  const { data: violations } = useListViolations({ query: { queryKey: getListViolationsQueryKey() } });
  const { data: stripeConfig } = useGetDuesStripeConfigured();

  const myWorkOrders = workOrders?.filter((wo) => wo.resident_name === resident?.name) ?? [];
  const openViolations = violations?.filter((v) => v.status === "open").length ?? 0;

  const API_BASE_URL = import.meta.env.VITE_API_URL || "";

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
        setOpen(false);
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

  const recentWOs = myWorkOrders.slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Welcome, ${resident?.name?.split(" ")[0]}`}
        subtitle={`Unit ${resident?.unit} · ${resident?.status === "owner" ? "Owner" : "Tenant"}`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-950 hover:bg-indigo-900 text-white" data-testid="button-new-work-order">
                <Plus className="w-4 h-4 mr-2" />
                New Work Order
              </Button>
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
        }
      />
      <PageContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-dues-status" className="border-l-4 border-l-stone-400">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-stone-100 rounded-xl p-3">
                  <CreditCard className="w-5 h-5 text-stone-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Dues Status</p>
                  <p className="text-xl font-bold text-slate-900">
                    {stripeConfig?.configured ? "Paid" : "Setup Needed"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-votes" className="border-l-4 border-l-indigo-900">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-50 rounded-xl p-3">
                  <Vote className="w-5 h-5 text-indigo-900" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Active Votes</p>
                  <p className="text-xl font-bold text-slate-900">1 Open</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-my-work-orders" className="border-l-4 border-l-amber-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-amber-50 rounded-xl p-3">
                  <Wrench className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Work Orders</p>
                  <p className="text-xl font-bold text-slate-900">{myWorkOrders.length} Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-open-violations" className="border-l-4 border-l-red-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-red-50/80 rounded-xl p-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Violations</p>
                  <p className="text-xl font-bold text-slate-900">{openViolations}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/voting" className="flex items-center justify-center p-4 bg-card border rounded-xl hover:bg-indigo-50/40 hover:border-indigo-200 transition-colors font-medium text-sm space-x-2 text-indigo-950">
            <Vote className="h-4 w-4" /> <span>Voting</span>
          </a>
          <a href="/dues" className="flex items-center justify-center p-4 bg-card border rounded-xl hover:bg-indigo-50/40 hover:border-indigo-200 transition-colors font-medium text-sm space-x-2 text-indigo-950">
            <CreditCard className="h-4 w-4" /> <span>Dues</span>
          </a>
          <a href="/documents" className="flex items-center justify-center p-4 bg-card border rounded-xl hover:bg-indigo-50/40 hover:border-indigo-200 transition-colors font-medium text-sm space-x-2 text-indigo-950">
            <FileText className="h-4 w-4" /> <span>Documents</span>
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="h-full border-t-2 border-t-indigo-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-indigo-950">
                <Clock className="w-4 h-4 text-indigo-900/70" />
                Recent Work Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {woLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : recentWOs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No work orders yet. Submit your first one above.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentWOs.map((wo) => (
                    <div key={wo.id} className="py-3 flex items-center justify-between" data-testid={`row-work-order-${wo.id}`}>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{wo.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{wo.category} · {wo.priority} priority</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${statusColor(wo.status)}`}>
                        {wo.status.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-full border-t-2 border-t-amber-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                <Megaphone className="w-4 h-4 text-amber-600/70" />
                Community Announcements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {annLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No community announcements have been posted yet.</p>
                </div>
              ) : (
                announcements
                  .slice()
                  .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
                  .map((announcement) => {
                    const colors = categoryColors[announcement.category] || categoryColors.general;
                    return (
                      <div 
                        key={announcement.id} 
                        className="p-4 rounded-xl border bg-card hover:bg-stone-50/50 transition-colors flex flex-col space-y-2"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                            <h4 className="font-semibold text-sm tracking-tight text-slate-900">{announcement.title}</h4>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {announcement.pinned && (
                              <Badge className="text-[10px] px-1.5 py-0 uppercase tracking-wider font-bold bg-amber-500 hover:bg-amber-600 text-white border-0">Pinned</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {announcement.createdAt ? new Date(announcement.createdAt).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) : "Recent"}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {announcement.content}
                        </p>
                      </div>
                    );
                  })
              )}
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
