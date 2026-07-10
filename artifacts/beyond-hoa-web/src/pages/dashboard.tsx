import { useState } from "react";
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
  MessageSquare, 
  Megaphone 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Option A: True Parity Seed Data mirrored from Mobile
const SEED_ANNOUNCEMENTS = [
  {
    id: '1',
    title: 'Annual Pool Maintenance',
    content: 'The community pool will be closed for seasonal maintenance from Monday through Wednesday next week.',
    category: 'maintenance',
    isPinned: true,
    date: 'Oct 12'
  },
  {
    id: '2',
    title: 'Budget Vote Approaching',
    content: 'Please review the proposed 2027 budget documents ahead of the upcoming community vote.',
    category: 'governance',
    isPinned: true,
    date: 'Oct 10'
  },
  {
    id: '3',
    title: 'Trash Collection Delay',
    content: 'Due to the holiday, trash and recycling pickup will be delayed by one day this week.',
    category: 'general',
    isPinned: false,
    date: 'Oct 09'
  }
];

const categoryColors: Record<string, { bg: string, text: string, dot: string }> = {
  governance: { bg: 'bg-blue-50 dark:bg-blue-950/50', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-600' },
  maintenance: { bg: 'bg-amber-50 dark:bg-amber-950/50', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  general: { bg: 'bg-green-50 dark:bg-green-950/50', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  urgent: { bg: 'bg-red-50 dark:bg-red-950/50', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
};

function statusColor(status: string) {
  switch (status) {
    case "open": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200";
    case "completed": return "bg-green-100 text-green-800 border-green-200";
    case "resolved": return "bg-green-100 text-green-800 border-green-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export default function DashboardPage() {
  const { resident } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "plumbing", priority: "medium", description: "" });

  const { data: workOrders, isLoading: woLoading } = useListWorkOrders({ query: { queryKey: getListWorkOrdersQueryKey() } });
  const { data: violations } = useListViolations({ query: { queryKey: getListViolationsQueryKey() } });
  const { data: stripeConfig } = useGetDuesStripeConfigured();

  const myWorkOrders = workOrders?.filter((wo) => wo.resident_name === resident?.name) ?? [];
  const openViolations = violations?.filter((v) => v.status === "open").length ?? 0;

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
              <Button data-testid="button-new-work-order">
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
                <Button type="submit" className="w-full" disabled={createWO.isPending} data-testid="button-submit-wo">
                  {createWO.isPending ? "Submitting..." : "Submit Work Order"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <PageContent className="space-y-6">
        {/* 1. Stat Tiles Row (Extended to 4 items) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Dues Status */}
          <Card data-testid="card-dues-status">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-green-100 rounded-xl p-3">
                  <CreditCard className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Dues Status</p>
                  <p className="text-xl font-bold text-foreground">
                    {stripeConfig?.configured ? "Paid" : "Setup Needed"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Votes (New Parity Addition) */}
          <Card data-testid="card-active-votes">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 rounded-xl p-3">
                  <Vote className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Active Votes</p>
                  <p className="text-xl font-bold text-foreground">1 Open</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Work Orders */}
          <Card data-testid="card-my-work-orders">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 rounded-xl p-3">
                  <Wrench className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Work Orders</p>
                  <p className="text-xl font-bold text-foreground">{myWorkOrders.length} Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Open Violations */}
          <Card data-testid="card-open-violations">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-red-100 rounded-xl p-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Violations</p>
                  <p className="text-xl font-bold text-foreground">{openViolations}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2. Quick Actions Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/voting" className="flex items-center justify-center p-4 bg-card border rounded-xl hover:bg-accent transition-colors font-medium text-sm space-x-2">
            <Vote className="h-4 w-4" /> <span>Voting</span>
          </a>
          <a href="/dues" className="flex items-center justify-center p-4 bg-card border rounded-xl hover:bg-accent transition-colors font-medium text-sm space-x-2">
            <CreditCard className="h-4 w-4" /> <span>Dues</span>
          </a>
          <a href="/documents" className="flex items-center justify-center p-4 bg-card border rounded-xl hover:bg-accent transition-colors font-medium text-sm space-x-2">
            <FileText className="h-4 w-4" /> <span>Documents</span>
          </a>
          <a href="/ai-advisor" className="flex items-center justify-center p-4 bg-card border rounded-xl hover:bg-accent transition-colors font-medium text-sm space-x-2">
            <MessageSquare className="h-4 w-4" /> <span>AI Advisor</span>
          </a>
        </div>

        {/* Bottom Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 3. Recent Work Orders Section */}
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
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
                        <p className="text-sm font-medium text-foreground">{wo.title}</p>
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

          {/* 4. Community Announcements Section */}
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-muted-foreground" />
                Community Announcements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {SEED_ANNOUNCEMENTS
                .slice()
                .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
                .map((announcement) => {
                  const colors = categoryColors[announcement.category] || categoryColors.general;
                  return (
                    <div 
                      key={announcement.id} 
                      className="p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors flex flex-col space-y-2"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                          <h4 className="font-semibold text-sm tracking-tight text-foreground">{announcement.title}</h4>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {announcement.isPinned && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase tracking-wider font-bold">Pinned</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{announcement.date}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {announcement.content}
                      </p>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
