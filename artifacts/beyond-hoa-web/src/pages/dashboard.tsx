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
import { AlertTriangle, Wrench, CreditCard, Plus, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      <PageContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card data-testid="card-my-work-orders">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 rounded-lg p-2">
                  <Wrench className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{myWorkOrders.length}</p>
                  <p className="text-xs text-muted-foreground">My Work Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-open-violations">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 rounded-lg p-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{openViolations}</p>
                  <p className="text-xs text-muted-foreground">Open Violations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-dues-status">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 rounded-lg p-2">
                  <CreditCard className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {stripeConfig?.configured ? "Dues Active" : "Dues Setup Needed"}
                  </p>
                  <p className="text-xs text-muted-foreground">Payment status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
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
      </PageContent>
    </>
  );
}
