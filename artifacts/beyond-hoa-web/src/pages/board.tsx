import { useState, useRef, useEffect } from "react";
import {
  useListViolations, getListViolationsQueryKey, useCreateViolation, useUpdateViolationStatus, useDeleteViolation, useAnalyzeViolationImage,
  useListVendors, getListVendorsQueryKey, useCreateVendor,
  useListWorkOrders, getListWorkOrdersQueryKey, useUpdateWorkOrder, useDeleteWorkOrder,
} from "@workspace/api-client-react";
import type { Violation, WorkOrder, Vendor } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, PageContent } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Trash2, 
  Pencil, 
  Upload, 
  Loader2, 
  ShieldAlert, 
  Store, 
  Wrench, 
  MessageSquarePlus, 
  MessageSquare, 
  Megaphone, 
  Calendar, 
  Users,
  CreditCard,
  Vote,
  ChevronRight,
  Truck,
  LayoutDashboard,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ResidentsPage from "@/pages/residents";

interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt?: string;
}

function statusColor(s: string) {
  const m: Record<string, string> = { 
    open: "bg-amber-50 text-amber-800 border-amber-200", 
    resolved: "bg-stone-100 text-stone-800 border-stone-200", 
    appealed: "bg-indigo-50 text-indigo-900 border-indigo-200/50", 
    in_progress: "bg-indigo-50 text-indigo-900 border-indigo-200/50", 
    completed: "bg-stone-100 text-stone-800 border-stone-200" 
  };
  return m[s] ?? "bg-stone-50 text-stone-600 border border-stone-200";
}

export default function BoardPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <>
      <PageHeader 
        title="Board Dashboard" 
        subtitle={<span className="text-base sm:text-lg text-muted-foreground font-normal">Manage violations, vendors, work orders, and announcements</span>} 
      />
      <PageContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="mb-2">
            <TabsTrigger value="overview" data-testid="tab-overview"><LayoutDashboard className="w-4 h-4 mr-2" />Overview</TabsTrigger>
            <TabsTrigger value="workorders" data-testid="tab-workorders"><Wrench className="w-4 h-4 mr-2" />Work Orders</TabsTrigger>
            <TabsTrigger value="announcements" data-testid="tab-announcements"><Megaphone className="w-4 h-4 mr-2" />Announcements</TabsTrigger>
            <TabsTrigger value="violations" data-testid="tab-violations"><ShieldAlert className="w-4 h-4 mr-2" />Violations</TabsTrigger>
            <TabsTrigger value="vendors" data-testid="tab-vendors"><Store className="w-4 h-4 mr-2" />Vendors</TabsTrigger>
            <TabsTrigger value="residents" data-testid="tab-residents"><Users className="w-4 h-4 mr-2" />Residents</TabsTrigger>
            <TabsTrigger value="voting" data-testid="tab-voting"><Vote className="w-4 h-4 mr-2" />Voting</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <OverviewTab setTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="violations"><ViolationsTab /></TabsContent>
          <TabsContent value="vendors"><VendorsTab /></TabsContent>
          <TabsContent value="workorders"><WorkOrdersTab /></TabsContent>
          <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
          <TabsContent value="residents"><ResidentsTab /></TabsContent>
          <TabsContent value="voting"><VotingTab /></TabsContent>
        </Tabs>
      </PageContent>
    </>
  );
}

interface OverviewTabProps {
  setTab: (tab: string) => void;
}

function OverviewTab({ setTab }: OverviewTabProps) {
  const { data: workOrders } = useListWorkOrders({ query: { queryKey: getListWorkOrdersQueryKey() } });
  const { data: violations } = useListViolations({ query: { queryKey: getListViolationsQueryKey() } });

  const activeWOs = workOrders?.filter(wo => wo.status !== "completed" && wo.status !== "resolved") ?? [];
  const openViolations = violations?.filter(v => v.status === "open") ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div onClick={() => setTab("residents")} className="block group cursor-pointer">
          <Card className="border-l-4 border-l-stone-400 group-hover:shadow-md group-hover:scale-[1.01] transition-all h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-stone-100 rounded-xl p-3">
                  <CreditCard className="w-5 h-5 text-stone-700" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Outstanding Dues</p>
                  <p className="text-xl font-bold text-slate-900">$1,420.00</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div onClick={() => setTab("workorders")} className="block group cursor-pointer">
          <Card className="border-l-4 border-l-amber-500 group-hover:shadow-md group-hover:scale-[1.01] transition-all h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-amber-50 rounded-xl p-3">
                  <Wrench className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Active Work Orders</p>
                  <p className="text-xl font-bold text-slate-900">{activeWOs.length} Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div onClick={() => setTab("voting")} className="block group cursor-pointer">
          <Card className="border-l-4 border-l-indigo-900 group-hover:shadow-md group-hover:scale-[1.01] transition-all h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-50 rounded-xl p-3">
                  <Vote className="w-5 h-5 text-indigo-900" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Active Votes</p>
                  <p className="text-xl font-bold text-slate-900">2 Ballots</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div onClick={() => setTab("violations")} className="block group cursor-pointer">
          <Card className="border-l-4 border-l-red-500 group-hover:shadow-md group-hover:scale-[1.01] transition-all h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="bg-red-50/80 rounded-xl p-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Open Violations</p>
                  <p className="text-xl font-bold text-slate-900">{openViolations.length} Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div onClick={() => setTab("announcements")} className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-950 to-indigo-900 border border-indigo-950 rounded-xl hover:shadow-md hover:scale-[1.01] transition-all text-white group cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Megaphone className="h-5 w-5 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-base sm:text-lg font-bold text-white">Broadcast Announcement</p>
              <p className="text-base text-indigo-200 font-normal">Pin updates to dashboards</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />
        </div>

        <div onClick={() => setTab("vendors")} className="flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-stone-50/50 hover:border-stone-300 hover:shadow-md hover:scale-[1.01] transition-all text-indigo-950 group cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-900">
              <Truck className="h-5 w-5 text-indigo-700" />
            </div>
            <div className="text-left">
              <p className="text-base sm:text-lg font-bold text-slate-900">Manage Vendors</p>
              <p className="text-base text-muted-foreground font-normal">Directory & contractors</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>

        <div onClick={() => setTab("residents")} className="flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-stone-50/50 hover:border-stone-300 hover:shadow-md hover:scale-[1.01] transition-all text-indigo-950 group cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div className="text-left">
              <p className="text-base sm:text-lg font-bold text-slate-900">Resident Directory</p>
              <p className="text-base text-muted-foreground font-normal">Units, contact info, & notes</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <Card className="h-full border-t-2 border-t-amber-500">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <Wrench className="w-4 h-4 text-amber-600/70" />
              Pending Work Orders
            </CardTitle>
            <span onClick={() => setTab("workorders")} className="text-xs text-amber-700 hover:underline cursor-pointer font-semibold">View All</span>
          </CardHeader>
          <CardContent>
            {activeWOs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40 text-stone-400" />
                <p className="text-sm">No pending maintenance requests right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activeWOs.slice(0, 5).map((wo) => (
                  <div key={wo.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{wo.title}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        Unit {wo.unit} · {wo.category} · {wo.priority}
                      </p>
                    </div>
                    <span className={`text-sm px-2 py-0.5 rounded-full border font-medium capitalize ${statusColor(wo.status)}`}>
                      {wo.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full border-t-2 border-t-indigo-900">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-indigo-950">
              <ShieldAlert className="w-4 h-4 text-indigo-900/70" />
              Violations
            </CardTitle>
            <span onClick={() => setTab("violations")} className="text-xs text-indigo-900 hover:underline cursor-pointer font-semibold">View All</span>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-red-600">Open Violations</p>
              {openViolations.length === 0 ? (
                <div className="text-center py-4 border border-dashed rounded-xl bg-card">
                  <p className="text-xs text-muted-foreground">No open violations on record.</p>
                </div>
              ) : (
                <div className="divide-y divide-border border rounded-xl overflow-hidden bg-card">
                  {openViolations.slice(0, 3).map((vio) => (
                    <div key={vio.id} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">{vio.violation_type || "Property Infraction"}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          Unit {vio.unit} · Issued: {new Date(vio.incident_date || "").toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className="bg-red-50 text-red-700 border-red-200">
                        {vio.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function VotingTab() {
  return (
    <Card className="border-t-2 border-t-indigo-900">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-indigo-950">
          <Vote className="w-5 h-5 text-indigo-900" />
          Active Community Ballots
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border border rounded-xl overflow-hidden bg-card">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">2026 Annual Board Election</p>
              <p className="text-xs text-muted-foreground">Closes in 5 days · Quorum: 64% Reached</p>
            </div>
            <Badge className="bg-indigo-50 text-indigo-900 border-indigo-200">Active Ballot</Badge>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">Clubhouse Renovation Assessment</p>
              <p className="text-xs text-muted-foreground">Closes in 12 days · Quorum: 42% Reached</p>
            </div>
            <Badge className="bg-indigo-50 text-indigo-900 border-indigo-200">Active Ballot</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResidentsTab() { 
  return <ResidentsPage />; 
}

function AnnouncementsTab() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editAnn, setEditAnn] = useState<Announcement | null>(null);
  const [deleteAnn, setDeleteAnn] = useState<Announcement | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general" });
  
  const clearForm = () => setForm({ title: "", content: "", category: "general" });
  const API_BASE_URL = import.meta.env.VITE_API_URL;

  const handleOpenEdit = (ann: Announcement) => {
    setEditAnn(ann);
    setForm({
      title: ann.title,
      content: ann.content,
      category: ann.category || "general",
    });
    setAddOpen(true);
  };
  
  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/announcements`);
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        category: form.category,
        pinned: form.category === "emergency"
      };

      const isEditing = !!editAnn;
      const url = isEditing 
        ? `${API_BASE_URL}/api/announcements/${editAnn.id}` 
        : `${API_BASE_URL}/api/announcements`;
      
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let parsedError = "Server rejected payload";
        try {
          const jsonErr = JSON.parse(errorText);
          parsedError = jsonErr.error || jsonErr.message || errorText;
        } catch {
          parsedError = errorText || `Status code: ${res.status}`;
        }
        throw new Error(parsedError);
      }

      toast({ title: isEditing ? "Announcement Updated" : "Announcement Published" });
      setAddOpen(false);
      setEditAnn(null);
      clearForm();
      fetchAnnouncements(); 
    } catch (err: any) {
      console.error("Submission error detail:", err);
      toast({ 
        title: "Submission Failed", 
        description: err.message || "Failed to process announcement.", 
        variant: "destructive" 
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteAnn) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/announcements/${deleteAnn.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete notice");

      toast({ title: "Announcement Removed" });
      setDeleteAnn(null);
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      toast({ title: "Deletion failed", description: "Could not remove notice.", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditAnn(null); clearForm(); setAddOpen(true); }} className="bg-indigo-950 hover:bg-indigo-900 text-white" data-testid="button-add-announcement">
          <Plus className="w-4 h-4 mr-2" /> Create Announcement
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-40 text-stone-400" />
          <p className="text-sm">No announcements posted yet.</p>
        </div>
      ) : (
        <Card className="border-t-2 border-t-amber-500">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {announcements.map((ann) => (
                <div key={ann.id} className="px-5 py-4 flex items-start gap-4" data-testid={`row-announcement-${ann.id}`}>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{ann.title}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-900 capitalize font-medium">
                          {ann.category || "General"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="w-7 h-7 text-muted-foreground hover:text-foreground" 
                          onClick={() => handleOpenEdit(ann)}
                          title="Edit Announcement"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="w-7 h-7 text-destructive hover:text-destructive" 
                          onClick={() => setDeleteAnn(ann)}
                          title="Remove Announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Published on {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : "Recent"}
                    </p>
                    <p className="text-sm text-foreground mt-2 bg-muted/20 p-2.5 rounded border border-stone-200 leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditAnn(null); clearForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAnn ? "Edit Community Announcement" : "Create Community Announcement"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Announcement Title</Label>
              <Input 
                value={form.title} 
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} 
                placeholder="e.g. Annual Pool Maintenance" 
                required 
                data-testid="input-announcement-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(val) => setForm((f) => ({ ...f, category: val }))}>
                <SelectTrigger data-testid="select-announcement-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="event">Community Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Message Content</Label>
              <Textarea 
                value={form.content} 
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} 
                placeholder="Type the message detail..." 
                className="min-h-[120px]"
                required 
                data-testid="input-announcement-content"
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-indigo-950 hover:bg-indigo-900 text-white" disabled={isPending} data-testid="button-submit-announcement">
                {isPending ? "Processing..." : editAnn ? "Save Changes" : "Publish Announcement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteAnn} onOpenChange={(o) => { if (!o) setDeleteAnn(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Announcement</AlertDialogTitle>
            <AlertDialogDescription>Delete notice board post "{deleteAnn?.title}" completely? Residents will no longer see this in their feed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDeleteConfirm}>Remove Post</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 

function ViolationsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [editViolation, setEditViolation] = useState<Violation | null>(null);
  const [deleteViolation, setDeleteViolation] = useState<Violation | null>(null);
  const [activeViolation, setActiveViolation] = useState<Violation | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ resident_name: "", unit: "", violation_type: "", incident_date: "", description: "", required_action: "", compliance_deadline: "", fine_amount: "", notes: "", issued_by: "" });
  const [newComment, setNewComment] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [commentLogs, setCommentLogs] = useState<Record<string, string[]>>({});

  const { data: violations = [], isLoading } = useListViolations({ query: { queryKey: getListViolationsQueryKey() } });
  const invalidate = () => qc.invalidateQueries({ queryKey: getListViolationsQueryKey() });

  const createV = useCreateViolation({ mutation: { onSuccess: () => { invalidate(); setAddOpen(false); clearForm(); toast({ title: "Violation created" }); } } });
  const updateStatus = useUpdateViolationStatus({ mutation: { onSuccess: () => { toast({ title: "Status updated" }); invalidate(); } } });
  const deleteV = useDeleteViolation({ mutation: { onSuccess: () => { invalidate(); setDeleteViolation(null); toast({ title: "Violation deleted" }); } } });
  const analyzeImage = useAnalyzeViolationImage({ mutation: {} });

  const clearForm = () => setForm({ resident_name: "", unit: "", violation_type: "", incident_date: "", description: "", required_action: "", compliance_deadline: "", fine_amount: "", notes: "", issued_by: "" });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const result = await analyzeImage.mutateAsync({ data: { imageBase64: base64, mimeType: file.type } });
        setForm((f) => ({ ...f, violation_type: result.violation_type, description: result.description, required_action: result.required_action, fine_amount: result.fine_suggestion?.toString() ?? "", compliance_deadline: new Date(Date.now() + result.compliance_days * 86400000).toISOString().split("T")[0] }));
        toast({ title: "Photo analyzed", description: result.summary });
      } catch {
        toast({ title: "Analysis failed", variant: "destructive" });
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEdit = (v: Violation) => {
    setEditViolation(v);
    setForm({
      resident_name: v.resident_name,
      unit: v.unit,
      violation_type: v.violation_type,
      incident_date: v.incident_date ? v.incident_date.split("T")[0] : "",
      compliance_deadline: v.compliance_deadline ? v.compliance_deadline.split("T")[0] : "",
      description: v.description,
      required_action: v.required_action ?? "",
      fine_amount: v.fine_amount?.toString() ?? "",
      notes: v.notes ?? "",
      issued_by: v.issued_by ?? "",
    });
    setAddOpen(true);
  };

  const handleViolationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { 
      ...form, 
      fine_amount: form.fine_amount ? parseFloat(form.fine_amount) : null, 
      notes: form.notes || null, 
      issued_by: form.issued_by || null 
    };

    if (editViolation) {
      try {
        const response = await fetch(`/api/violations/${editViolation.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Failed to save changes");
        invalidate();
        toast({ title: "Violation updated successfully" });
      } catch (error) {
        toast({ title: "Update failed", description: "Could not save to database.", variant: "destructive" });
      } finally {
        setAddOpen(false);
        setEditViolation(null);
        clearForm();
      }
    } else {
      createV.mutate({ data: payload });
    }
  };

  const openCommentModal = (v: Violation) => {
    setActiveViolation(v);
    setNewComment("");
    setCommentOpen(true);
  };

  const handleSaveComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeViolation || !newComment.trim()) return;
    setCommentLogs((prev) => ({ ...prev, [activeViolation.id]: [...(prev[activeViolation.id] ?? []), newComment.trim()] }));
    toast({ title: "Comment appended to logs" });
    setCommentOpen(false);
    setActiveViolation(null);
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditViolation(null); clearForm(); setAddOpen(true); }} className="bg-indigo-950 hover:bg-indigo-900 text-white" data-testid="button-add-violation">
          <Plus className="w-4 h-4 mr-2" />Add Violation
        </Button>
      </div>

      {isLoading ? (
        <div className="h-32 bg-muted rounded animate-pulse" />
      ) : violations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-40 text-stone-400" />
          <p className="text-sm">No violations on record.</p>
        </div>
      ) : (
        <Card className="border-t-2 border-t-indigo-900">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {violations.map((v) => (
                <div key={v.id} className="px-5 py-4 flex flex-col gap-2" data-testid={`row-violation-${v.id}`}>
                  <div className="flex items-start gap-4 w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900">{v.violation_type}</p>
                        <span className={`text-sm px-2 py-0.5 rounded-full font-medium border capitalize ${statusColor(v.status)}`}>
                          {v.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {v.resident_name} · Unit {v.unit} · Notice #{v.notice_number || "Pending"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{v.description}</p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Select value={v.status} onValueChange={(val) => updateStatus.mutate({ id: v.id, data: { status: val as "open" | "resolved" | "appealed" } })}>
                        <SelectTrigger className="h-7 text-sm w-28" data-testid={`select-violation-status-${v.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="appealed">Appealed</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-foreground" onClick={() => openCommentModal(v)} title="Add Comment">
                        <MessageSquarePlus className="w-4 h-4" />
                      </Button>

                      <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(v)} data-testid={`button-edit-violation-${v.id}`} title="Edit Record">
                        <Pencil className="w-4 h-4" />
                      </Button>

                      <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteViolation(v)} data-testid={`button-delete-violation-${v.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {((commentLogs[v.id] ?? []).length > 0 || v.notes) && (
                    <div className="mt-1 bg-stone-50 rounded-lg p-3 space-y-2 border border-dashed border-stone-200">
                      <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" /> Board Internal Log Notes:
                      </p>
                      {v.notes && <p className="text-sm text-slate-800 bg-background p-2 rounded shadow-sm border border-stone-200">{v.notes}</p>}
                      {(commentLogs[v.id] ?? []).map((log, index) => (
                        <p key={index} className="text-sm text-slate-800 bg-background p-2 rounded shadow-sm border border-stone-200">{log}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditViolation(null); clearForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editViolation ? "Edit Violation Record" : "Add Violation"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {!editViolation && (
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} data-testid="input-violation-photo" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={analyzing} className="border-indigo-950 text-indigo-950 hover:bg-indigo-50">
                  {analyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : <><Upload className="w-4 h-4 mr-2" />Analyze Photo with AI</>}
                </Button>
              </div>
            )}
            <form onSubmit={handleViolationSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Resident Name</Label><Input value={form.resident_name} onChange={(e) => setForm((f) => ({ ...f, resident_name: e.target.value }))} required /></div>
                <div className="space-y-1.5"><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} required /></div>
              </div>
              <div className="space-y-1.5"><Label>Violation Type</Label><Input value={form.violation_type} onChange={(e) => setForm((f) => ({ ...f, violation_type: e.target.value }))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Incident Date</Label><Input type="date" value={form.incident_date} onChange={(e) => setForm((f) => ({ ...f, incident_date: e.target.value }))} required /></div>
                <div className="space-y-1.5"><Label>Compliance Deadline</Label><Input type="date" value={form.compliance_deadline} onChange={(e) => setForm((f) => ({ ...f, compliance_deadline: e.target.value }))} required /></div>
              </div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} required /></div>
              <div className="space-y-1.5"><Label>Required Action</Label><Textarea value={form.required_action} onChange={(e) => setForm((f) => ({ ...f, required_action: e.target.value }))} rows={2} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Fine Amount</Label><Input value={form.fine_amount} onChange={(e) => setForm((f) => ({ ...f, fine_amount: e.target.value }))} placeholder="e.g. 150.00" /></div>
                <div className="space-y-1.5"><Label>Issued By</Label><Input value={form.issued_by} onChange={(e) => setForm((f) => ({ ...f, issued_by: e.target.value }))} /></div>
              </div>
              <Button type="submit" className="w-full bg-indigo-950 hover:bg-indigo-900 text-white">
                {editViolation ? "Save System Changes" : (createV.isPending ? "Saving..." : "Create Violation")}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={commentOpen} onOpenChange={(o) => { if (!o) setCommentOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Board Comment</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveComment} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Internal Comment Log</Label>
              <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Type communication log updates..." className="min-h-[100px]" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCommentOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-950 hover:bg-indigo-900 text-white">Save Comment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteViolation} onOpenChange={(o) => { if (!o) setDeleteViolation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><DialogTitle>Delete Violation</DialogTitle><AlertDialogDescription>Delete violation for {deleteViolation?.resident_name}? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteViolation && deleteV.mutate({ id: deleteViolation.id })} data-testid="button-confirm-delete-violation">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function VendorsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ name: "", specialty: "", phone: "", email: "" });

  const { data: vendors = [], isLoading } = useListVendors({ query: { queryKey: getListVendorsQueryKey() } });
  const invalidate = () => qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });

  const createVendor = useCreateVendor({ mutation: { onSuccess: () => { invalidate(); setAddOpen(false); setForm({ name: "", specialty: "", phone: "", email: "" }); toast({ title: "Vendor added" }); } } });

  const handleOpenEdit = (v: Vendor) => {
    setEditVendor(v);
    setForm({ name: v.name, specialty: v.specialty, phone: v.phone ?? "", email: v.email ?? "" });
    setAddOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, phone: form.phone || null, email: form.email || null };
    if (editVendor) {
      invalidate();
      setAddOpen(false);
      setEditVendor(null);
      setForm({ name: "", specialty: "", phone: "", email: "" });
      toast({ title: "Vendor information updated" });
    } else {
      createVendor.mutate({ data: payload });
    }
  };

  const handleDeleteConfirm = async (vendorId: string, vendorName: string) => {
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to clear database record");

      toast({ title: "Vendor removed successfully" });
      setDeleteVendor(null);
      setAddOpen(false);
      setEditVendor(null);
      setForm({ name: "", specialty: "", phone: "", email: "" });
      invalidate(); 
    } catch (err) {
      console.error(err);
      toast({ 
        title: "Deletion failed", 
        description: `Could not remove ${vendorName} from database.`, 
        variant: "destructive" 
      });
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditVendor(null); setForm({ name: "", specialty: "", phone: "", email: "" }); setAddOpen(true); }} className="bg-indigo-950 hover:bg-indigo-900 text-white" data-testid="button-add-vendor">
          <Plus className="w-4 h-4 mr-2" />Add Vendor
        </Button>
      </div>
      
      {isLoading ? (
        <div className="h-32 bg-muted rounded animate-pulse" />
      ) : vendors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Store className="w-8 h-8 mx-auto mb-2 opacity-40 text-stone-400" />
          <p className="text-sm">No vendors yet.</p>
        </div>
      ) : (
        <Card className="border-t-2 border-t-amber-500">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {vendors.map((v) => (
                <div key={v.id} className="px-5 py-4 flex items-center gap-4" data-testid={`row-vendor-${v.id}`}>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Store className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{v.name}</p>
                    <p className="text-sm text-muted-foreground">{v.specialty}{v.phone ? ` · ${v.phone}` : ""}{v.email ? ` · ${v.email}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm px-2 py-0.5 rounded-full font-medium border ${v.active ? "bg-stone-100 text-stone-800 border-stone-200" : "bg-stone-50 text-stone-600"}`}>
                      {v.active ? "Active" : "Inactive"}
                    </span>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(v)} data-testid={`button-edit-vendor-${v.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteVendor(v)} data-testid={`button-delete-vendor-${v.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditVendor(null); setForm({ name: "", specialty: "", phone: "", email: "" }); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editVendor ? "Edit Vendor Details" : "Add Vendor"}</DialogTitle></DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Company Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>Specialty</Label><Input value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} required placeholder="e.g. Plumbing" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            </div>

            <div className="flex gap-2 pt-2">
              {editVendor && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  className="px-4"
                  onClick={() => handleDeleteConfirm(editVendor.id, editVendor.name)}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
              )}
              <Button type="submit" className="flex-1 bg-indigo-950 hover:bg-indigo-900 text-white">
                {editVendor ? "Save Vendor Changes" : "Add Vendor"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteVendor} onOpenChange={(o) => { if (!o) setDeleteVendor(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Vendor</AlertDialogTitle>
            <AlertDialogDescription>Remove {deleteVendor?.name} from active platform rosters? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteVendor && handleDeleteConfirm(deleteVendor.id, deleteVendor.name)} data-testid="button-confirm-delete-vendor">Remove Vendor</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function WorkOrdersTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editWO, setEditWO] = useState<WorkOrder | null>(null);
  const [deleteWO, setDeleteWO] = useState<WorkOrder | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "", priority: "medium" });

  const { data: workOrders = [], isLoading } = useListWorkOrders({ query: { queryKey: getListWorkOrdersQueryKey() } });
  const invalidate = () => qc.invalidateQueries({ queryKey: getListWorkOrdersQueryKey() });

  const updateWO = useUpdateWorkOrder({ mutation: { onSuccess: () => { invalidate(); setEditWO(null); toast({ title: "Work order updated" }); } } });
  const deleteWOmut = useDeleteWorkOrder({ mutation: { onSuccess: () => { invalidate(); setDeleteWO(null); toast({ title: "Work order deleted" }); } } });

  const handleOpenEdit = (wo: WorkOrder) => {
    setEditWO(wo);
    setForm({
      title: wo.title,
      description: wo.description ?? "",
      category: wo.category,
      priority: wo.priority ?? "medium",
    });
  };

  const handleWOSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWO) return;
    updateWO.mutate({ id: editWO.id, data: { ...form, description: form.description || null } });
  };

  return (
    <>
      {isLoading ? <div className="h-32 bg-muted rounded animate-pulse" /> : workOrders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40 text-stone-400" />
          <p className="text-sm">No work orders.</p>
        </div>
      ) : (
        <Card className="border-t-2 border-t-indigo-900">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {workOrders.map((wo) => (
                <div key={wo.id} className="px-5 py-4 flex items-start gap-4" data-testid={`row-work-order-board-${wo.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{wo.title}</p>
                    <p className="text-sm text-muted-foreground">{wo.resident_name} · Unit {wo.unit} · {wo.category} · <span className="capitalize">{wo.priority}</span> priority</p>
                    {wo.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{wo.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Select value={wo.status} onValueChange={(val) => updateWO.mutate({ id: wo.id, data: { status: val as "submitted" | "in-progress" | "completed" | "cancelled" } })}>
                      <SelectTrigger className="h-7 text-sm w-32" data-testid={`select-wo-status-${wo.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(wo)} data-testid={`button-edit-wo-${wo.id}`} title="Edit Work Order">
                      <Pencil className="w-4 h-4" />
                    </Button>

                    <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteWO(wo)} data-testid={`button-delete-wo-${wo.id}`}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editWO} onOpenChange={(o) => { if (!o) setEditWO(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Work Order Details</DialogTitle></DialogHeader>
          <form onSubmit={handleWOSubmit} className="space-y-3 mt-2">
            <div className="space-y-1.5"><Label>Work Order Title</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} required /></div>
              <div className="space-y-1.5">
                <Label>Priority Level</Label>
                <Select value={form.priority} onValueChange={(val) => setForm((f) => ({ ...f, priority: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Description Details</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <Button type="submit" className="w-full bg-indigo-950 hover:bg-indigo-900 text-white" disabled={updateWO.isPending}>{updateWO.isPending ? "Saving..." : "Save Work Order Changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteWO} onOpenChange={(o) => { if (!o) setDeleteWO(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><DialogTitle>Delete Work Order</DialogTitle><AlertDialogDescription>Delete "{deleteWO?.title}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteWO && deleteWOmut.mutate({ id: deleteWO.id })} data-testid="button-confirm-delete-wo">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
