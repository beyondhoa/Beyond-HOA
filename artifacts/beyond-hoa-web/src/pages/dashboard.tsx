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
  Mail,
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

export default function DashboardPage() {
  const { resident } = useAuth();
  const [, setLocation] = useLocation();

  if (!resident) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-sans">
        <p className="text-xl text-slate-500 animate-pulse font-normal">Loading…</p>
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
    <div className="w-full min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-10 pb-24 md:pb-10 font-sans">
      
      {/* ── Page Header ── */}
      <div className="mb-6 md:mb-8 border-b border-slate-200 pb-5">
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
          Welcome, {resident?.name?.split(" ")[0]}
        </h1>
        <p className="text-xl font-medium text-slate-500 mt-1">
          Unit {resident?.unit} · {resident?.status === "owner" ? "Owner" : "Tenant"}
        </p>
      </div>

      {/* ── Main Dashboard Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8 items-start">

        {/* ── Primary Section ── */}
        <div className="xl:col-span-2 space-y-6 lg:space-y-8">

          {/* Stat Tiles */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-normal mb-3 lg:mb-4">
              Overview
            </h2>
            
            {/* 3-COLUMN GRID FIXED IN A SINGLE ROW ACROSS ALL SCREEN SIZES */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-6">

              {/* Dues Card */}
              <div
                onClick={() => setLocation("/dues")}
                className="bg-white rounded-2xl border border-slate-200/80 border-l-4 border-l-rose-500 p-2.5 sm:p-6 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between min-h-[120px] sm:min-h-[160px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">DUES</span>
                  <div className="p-1.5 sm:p-3 bg-rose-50 rounded-lg sm:rounded-xl">
                    <CreditCard className="w-4 h-4 sm:w-6 sm:h-6 text-rose-500" />
                  </div>
                </div>
                <div className="mt-1 sm:mt-0">
                  <div className="text-xl sm:text-3xl font-extrabold text-slate-900 leading-none">
                    {stripeConfig?.configured ? "$0" : "$155"}
                  </div>
                  <p className="text-[10px] sm:text-sm font-medium text-rose-500 mt-1 sm:mt-2.5 truncate">
                    {stripeConfig?.configured ? "Paid" : "Due Mar 30"}
                  </p>
                </div>
              </div>

              {/* Work Orders Card */}
              <div
                onClick={() => setWoOpen(true)}
                className="bg-white rounded-2xl border border-slate-200/80 border-l-4 border-l-amber-500 p-2.5 sm:p-6 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between min-h-[120px] sm:min-h-[160px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">ORDERS</span>
                  <div className="p-1.5 sm:p-3 bg-amber-50 rounded-lg sm:rounded-xl">
                    <Wrench className="w-4 h-4 sm:w-6 sm:h-6 text-amber-500" />
                  </div>
                </div>
                <div className="mt-1 sm:mt-0">
                  <div className="text-xl sm:text-3xl font-extrabold text-slate-900 leading-none">
                    {activeWorkOrders.length}
                  </div>
                  <p className="text-[10px] sm:text-sm font-medium text-amber-500 mt-1 sm:mt-2.5">Active</p>
                </div>
              </div>

              {/* Votes Card (Fixed on the same row) */}
              <div
                onClick={() => setLocation("/voting")}
                className="bg-white rounded-2xl border border-slate-200/80 border-l-4 border-l-blue-500 p-2.5 sm:p-6 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between min-h-[120px] sm:min-h-[160px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">VOTES</span>
                  <div className="p-1.5 sm:p-3 bg-blue-50 rounded-lg sm:rounded-xl">
                    <Vote className="w-4 h-4 sm:w-6 sm:h-6 text-blue-500" />
                  </div>
                </div>
                <div className="mt-1 sm:mt-0">
                  <div className="text-xl sm:text-3xl font-extrabold text-slate-900 leading-none">1</div>
                  <p className="text-[10px] sm:text-sm font-medium text-blue-500 mt-1 sm:mt-2.5">Open</p>
                </div>
              </div>

            </div>
          </div>

          {/* Quick Actions Grid */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-normal mb-3 lg:mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-2 gap-2.5 sm:gap-6">

              <div
                onClick={() => setLocation("/dues")}
                className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-6 shadow-sm hover:border-slate-300 hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row items-center justify-center sm:justify-start text-center sm:text-left space-y-2 sm:space-y-0 sm:space-x-5 min-h-[90px] sm:min-h-[110px]"
              >
                <div className="p-2.5 sm:p-4 bg-rose-50 rounded-xl sm:rounded-2xl text-rose-500 shrink-0">
                  <CreditCard className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-lg font-bold text-slate-900 leading-tight">Pay Dues</h3>
                  <p className="hidden sm:block text-sm font-normal text-slate-500 mt-1">Manage online HOA dues</p>
                </div>
              </div>

              <div
                onClick={() => setWoOpen(true)}
                className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-6 shadow-sm hover:border-slate-300 hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row items-center justify-center sm:justify-start text-center sm:text-left space-y-2 sm:space-y-0 sm:space-x-5 min-h-[90px] sm:min-h-[110px]"
              >
                <div className="p-2.5 sm:p-4 bg-amber-50 rounded-xl sm:rounded-2xl text-amber-500 shrink-0">
                  <Wrench className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-lg font-bold text-slate-900 leading-tight">Report Issue</h3>
                  <p className="hidden sm:block text-sm font-normal text-slate-500 mt-1">Submit maintenance ticket</p>
                </div>
              </div>

              <div
                onClick={() => setLocation("/documents")}
                className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-6 shadow-sm hover:border-slate-300 hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row items-center justify-center sm:justify-start text-center sm:text-left space-y-2 sm:space-y-0 sm:space-x-5 min-h-[90px] sm:min-h-[110px]"
              >
                <div className="p-2.5 sm:p-4 bg-blue-50 rounded-xl sm:rounded-2xl text-blue-500 shrink-0">
                  <FileText className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-lg font-bold text-slate-900 leading-tight">Documents</h3>
                  <p className="hidden sm:block text-sm font-normal text-slate-500 mt-1">Access bylaws & policies</p>
                </div>
              </div>

              <a
                href="mailto:board@beyondhoa.com"
                className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-6 shadow-sm hover:border-slate-300 hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row items-center justify-center sm:justify-start text-center sm:text-left space-y-2 sm:space-y-0 sm:space-x-5 min-h-[90px] sm:min-h-[110px]"
              >
                <div className="p-2.5 sm:p-4 bg-emerald-50 rounded-xl sm:rounded-2xl text-emerald-500 shrink-0">
                  <Mail className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-lg font-bold text-slate-900 leading-tight">Contact Board</h3>
                  <p className="hidden sm:block text-sm font-normal text-slate-500 mt-1">Direct email communication</p>
                </div>
              </a>

            </div>
          </div>

        </div>

        {/* ── Secondary Panel (Announcements) ── */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
            <div className="flex items-center space-x-3 text-slate-900 font-bold text-lg sm:text-xl border-b border-slate-100 pb-4">
              <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
              <h3>Announcements</h3>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {annLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
              ) : sortedAnnouncements.length === 0 ? (
                <p className="text-sm sm:text-base font-normal text-slate-400 py-6 text-center">No announcements posted yet.</p>
              ) : (
                sortedAnnouncements.map((announcement) => (
                  <div key={announcement.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-1.5">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-slate-900 text-sm sm:text-base">{announcement.title}</h4>
                      <span className="text-xs text-slate-400 font-normal shrink-0 ml-2">
                        {announcement.createdAt
                          ? new Date(announcement.createdAt).toLocaleDateString(undefined, { month: "short", day: "2-digit" })
                          : "Jul 15"}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">{announcement.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Work Order Dialog ── */}
      <Dialog open={woOpen} onOpenChange={setWoOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Submit Work Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="wo-title" className="text-sm font-medium">Title</Label>
              <Input
                id="wo-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Brief description of the issue"
                required
                className="text-base h-12 font-sans font-normal"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-12 text-base font-sans font-normal"><SelectValue /></SelectTrigger>
                  <SelectContent className="font-sans font-normal">
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="electrical">Electrical</SelectItem>
                    <SelectItem value="hvac">HVAC</SelectItem>
                    <SelectItem value="landscaping">Landscaping</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-12 text-base font-sans font-normal"><SelectValue /></SelectTrigger>
                  <SelectContent className="font-sans font-normal">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-desc" className="text-sm font-medium">Description</Label>
              <Textarea
                id="wo-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the issue in detail…"
                rows={3}
                required
                className="text-base font-sans font-normal"
              />
            </div>
            <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold h-12 rounded-xl text-base font-sans" disabled={createWO.isPending}>
              {createWO.isPending ? "Submitting…" : "Submit Work Order"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
