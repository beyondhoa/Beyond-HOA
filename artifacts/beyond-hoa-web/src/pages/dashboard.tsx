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
  governance: { bg: "bg-emerald-100", text: "text-emerald-700" },
  maintenance: { bg: "bg-amber-100",  text: "text-amber-700" },
  general:    { bg: "bg-emerald-100", text: "text-emerald-700" },
  emergency:  { bg: "bg-red-100",     text: "text-red-700" },
  event:      { bg: "bg-amber-100",   text: "text-amber-700" },
};

export default function DashboardPage() {
  const { resident } = useAuth();
  const [, setLocation] = useLocation();

  if (!resident) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-xl text-muted-foreground animate-pulse font-semibold">Loading…</p>
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
      if (res.ok) setAnnouncements(await res.json());
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setAnnLoading(false);
    }
  };

  useEffect(() => { fetchAnnouncements(); }, []);

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
    <div className="w-full bg-gray-50">

      {/* ── Page Title ── */}
      <div className="px-5 pt-6 pb-4 bg-white border-b border-gray-100">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">
          Welcome, {resident?.name?.split(" ")[0]}
        </h1>
        <p className="text-base font-semibold text-gray-500 mt-1">
          Unit {resident?.unit} · {resident?.status === "owner" ? "Owner" : "Tenant"}
        </p>
      </div>

      <div className="px-4 py-5 space-y-6">

        {/* ── Stat Tiles ── */}
        <div className="grid grid-cols-3 gap-3">

          <div onClick={() => setLocation("/dues")} data-testid="link-dues" className="cursor-pointer">
            <Card className="border-0 rounded-2xl bg-white shadow-sm active:scale-95 transition-transform">
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-3">
                  <CreditCard className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Dues</p>
                <p className="text-3xl font-black text-gray-900 leading-none">
                  {stripeConfig?.configured ? "$0" : "$155"}
                </p>
                <p className="text-sm font-bold text-red-500 mt-2">
                  {stripeConfig?.configured ? "Paid" : "Due Mar 30"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div onClick={() => setWoOpen(true)} className="cursor-pointer">
            <Card className="border-0 rounded-2xl bg-white shadow-sm active:scale-95 transition-transform">
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                  <Wrench className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Orders</p>
                <p className="text-3xl font-black text-gray-900 leading-none">{activeWorkOrders.length}</p>
                <p className="text-sm font-bold text-amber-600 mt-2">Active</p>
              </CardContent>
            </Card>
          </div>

          <div onClick={() => setLocation("/voting")} data-testid="link-votes" className="cursor-pointer">
            <Card className="border-0 rounded-2xl bg-white shadow-sm active:scale-95 transition-transform">
              <CardContent className="p-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                  <Vote className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Votes</p>
                <p className="text-3xl font-black text-gray-900 leading-none">1</p>
                <p className="text-sm font-bold text-blue-600 mt-2">Open</p>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* ── Quick Actions ── */}
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3">

            <div onClick={() => setLocation("/dues")} data-testid="link-pay-dues"
              className="bg-white rounded-2xl p-5 shadow-sm cursor-pointer active:scale-95 transition-transform">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mb-4">
                <CreditCard className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-black text-gray-900">Pay Dues</h3>
              <p className="text-sm font-medium text-gray-500 mt-1">
                {stripeConfig?.configured ? "$0 due" : "$155 due Mar 30"}
              </p>
            </div>

            <div onClick={() => setWoOpen(true)} data-testid="link-report-issue"
              className="bg-white rounded-2xl p-5 shadow-sm cursor-pointer active:scale-95 transition-transform">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
                <Wrench className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900">Report Issue</h3>
              <p className="text-sm font-medium text-gray-500 mt-1">Submit a work order</p>
            </div>

            <div onClick={() => setLocation("/documents")} data-testid="link-documents"
              className="bg-white rounded-2xl p-5 shadow-sm cursor-pointer active:scale-95 transition-transform">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900">Documents</h3>
              <p className="text-sm font-medium text-gray-500 mt-1">Bylaws & guidelines</p>
            </div>

            <a href="mailto:board@beyondhoa.com" data-testid="link-contact-board"
              className="bg-white rounded-2xl p-5 shadow-sm cursor-pointer active:scale-95 transition-transform block">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900">Contact Board</h3>
              <p className="text-sm font-medium text-gray-500 mt-1">Message administrators</p>
            </a>

          </div>
        </div>

        {/* ── Announcements ── */}
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Announcements</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
            {annLoading ? (
              <div className="p-5 space-y-4">
                {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : sortedAnnouncements.length === 0 ? (
              <div className="text-center py-10">
                <Megaphone className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-base font-semibold text-gray-400">No announcements yet.</p>
              </div>
            ) : (
              sortedAnnouncements.map((announcement) => {
                const colors = categoryColors[announcement.category] || categoryColors.general;
                return (
                  <div key={announcement.id} className="p-4 flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}>
                      <Megaphone className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-base font-bold text-gray-900 leading-snug">{announcement.title}</h4>
                        <span className="text-xs font-semibold text-gray-400 shrink-0 mt-0.5">
                          {announcement.createdAt
                            ? new Date(announcement.createdAt).toLocaleDateString(undefined, { month: "short", day: "2-digit" })
                            : "Jul 15"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 font-medium mt-1 line-clamp-2">{announcement.content}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ── Work Order Dialog ── */}
      <Dialog open={woOpen} onOpenChange={setWoOpen}>
        <DialogContent className="max-w-[92vw] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Submit Work Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="wo-title" className="text-base font-bold">Title</Label>
              <Input
                id="wo-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Brief description of the issue"
                required
                className="text-base h-12"
                data-testid="input-wo-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-base font-bold">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-12 text-base" data-testid="select-wo-category">
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
              <div className="space-y-2">
                <Label className="text-base font-bold">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-12 text-base" data-testid="select-wo-priority">
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
            <div className="space-y-2">
              <Label htmlFor="wo-desc" className="text-base font-bold">Description</Label>
              <Textarea
                id="wo-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the issue in detail…"
                rows={3}
                required
                className="text-base"
                data-testid="input-wo-description"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-indigo-950 hover:bg-indigo-900 text-white font-black text-lg h-14 rounded-2xl"
              disabled={createWO.isPending}
              data-testid="button-submit-wo"
            >
              {createWO.isPending ? "Submitting…" : "Submit Work Order"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}