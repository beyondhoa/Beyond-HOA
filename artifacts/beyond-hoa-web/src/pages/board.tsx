import { useState, useRef, useEffect } from "react";
import {
  useListViolations, getListViolationsQueryKey, useCreateViolation, useUpdateViolationStatus, useDeleteViolation, useAnalyzeViolationImage,
  useListVendors, getListVendorsQueryKey, useCreateVendor,
  useListWorkOrders, getListWorkOrdersQueryKey, useUpdateWorkOrder, useDeleteWorkOrder,
} from "@workspace/api-client-react";
import type { Violation, WorkOrder, Vendor } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, PageContent } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, Upload, Loader2, ShieldAlert, Store, Wrench, MessageSquarePlus, MessageSquare, Megaphone, Calendar, Users } from "lucide-react";
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
    open: "bg-yellow-100 text-yellow-800", 
    resolved: "bg-green-100 text-green-800", 
    appealed: "bg-blue-100 text-blue-800", 
    in_progress: "bg-blue-100 text-blue-800", 
    completed: "bg-green-100 text-green-800" 
  };
  return m[s] ?? "bg-gray-100 text-gray-800";
}

export default function BoardPage() {
  return (
    <>
      <PageHeader title="Board Dashboard" subtitle="Manage violations, vendors, work orders, and announcements" />
      <PageContent>
        <Tabs defaultValue="workorders">
          <TabsList className="mb-6">
            <TabsTrigger value="workorders" data-testid="tab-workorders"><Wrench className="w-4 h-4 mr-2" />Work Orders</TabsTrigger>
            <TabsTrigger value="announcements" data-testid="tab-announcements"><Megaphone className="w-4 h-4 mr-2" />Announcements</TabsTrigger>
            <TabsTrigger value="violations" data-testid="tab-violations"><ShieldAlert className="w-4 h-4 mr-2" />Violations</TabsTrigger>
            <TabsTrigger value="vendors" data-testid="tab-vendors"><Store className="w-4 h-4 mr-2" />Vendors</TabsTrigger>
            <TabsTrigger value="residents" data-testid="tab-residents"><Users className="w-4 h-4 mr-2" />Residents</TabsTrigger>
          </TabsList>
          <TabsContent value="violations"><ViolationsTab /></TabsContent>
          <TabsContent value="vendors"><VendorsTab /></TabsContent>
          <TabsContent value="workorders"><WorkOrdersTab /></TabsContent>
          <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
          <TabsContent value="residents"><ResidentsTab /></TabsContent>
        </Tabs>
      </PageContent>
    </>
  );
}

function ResidentsTab() { 
  return <ResidentsPage />; 
}

function AnnouncementsTab() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "general" });
  
  const clearForm = () => setForm({ title: "", content: "", category: "general" });

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/announcements");
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
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to post");

      toast({ title: "Announcement Published" });
      setAddOpen(false);
      clearForm();
      fetchAnnouncements(); // Refresh the list view
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to publish announcement.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setAddOpen(true)} data-testid="button-add-announcement">
          <Plus className="w-4 h-4 mr-2" /> Create Announcement
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No announcements posted yet.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {announcements.map((ann) => (
                <div key={ann.id} className="px-5 py-4 flex items-start gap-4" data-testid={`row-announcement-${ann.id}`}>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-4 h-4 text-blue-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{ann.title}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize font-medium">
                        {ann.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Published on {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : "Recent"}
                    </p>
                    <p className="text-xs text-foreground mt-2 bg-muted/20 p-2.5 rounded border leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Community Announcement</DialogTitle></DialogHeader>
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
              <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-announcement">
                {isPending ? "Publishing..." : "Publish Announcement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
  const updateStatus = useUpdateViolationStatus({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Status updated" }); } } });
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
        <Button onClick={() => { setEditViolation(null); clearForm(); setAddOpen(true); }} data-testid="button-add-violation">
          <Plus className="w-4 h-4 mr-2" />Add Violation
        </Button>
      </div>

      {isLoading ? (
        <div className="h-32 bg-muted rounded animate-pulse" />
      ) : violations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No violations on record.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {violations.map((v) => (
                <div key={v.id} className="px-5 py-4 flex flex-col gap-2" data-testid={`row-violation-${v.id}`}>
                  <div className="flex items-start gap-4 w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{v.violation_type}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor(v.status)}`}>
                          {v.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {v.resident_name} · Unit {v.unit} · Notice #{v.notice_number || "Pending"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{v.description}</p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Select value={v.status} onValueChange={(val) => updateStatus.mutate({ id: v.id, data: { status: val as "open" | "resolved" | "appealed" } })}>
                        <SelectTrigger className="h-7 text-xs w-28" data-testid={`select-violation-status-${v.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="appealed">Appealed</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-foreground" onClick={() => openCommentModal(v)} title="Add Comment">
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                      </Button>

                      <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleOpenEdit(v)} data-testid={`button-edit-violation-${v.id}`} title="Edit Record">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>

                      <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteViolation(v)} data-testid={`button-delete-violation-${v.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {((commentLogs[v.id] ?? []).length > 0 || v.notes) && (
                    <div className="mt-1 bg-muted/40 rounded-lg p-3 space-y-2 border border-dashed">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Board Internal Log Notes:
                      </p>
                      {v.notes && <p className="text-xs text-foreground bg-background p-2 rounded shadow-sm border">{v.notes}</p>}
                      {(commentLogs[v.id] ?? []).map((log, index) => (
                        <p key={index} className="text-xs text-foreground bg-background p-2 rounded shadow-sm border">{log}</p>
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
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={analyzing}>
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
              <Button type="submit" className="w-full">
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
              <Button type="submit">Save Comment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteViolation} onOpenChange={(o) => { if (!o) setDeleteViolation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Violation</AlertDialogTitle><AlertDialogDescription>Delete violation for {deleteViolation?.resident_name}? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
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

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditVendor(null); setForm({ name: "", specialty: "", phone: "", email: "" }); setAddOpen(true); }} data-testid="button-add-vendor"><Plus className="w-4 h-4 mr-2" />Add Vendor</Button>
      </div>
      {isLoading ? <div className="h-32 bg-muted rounded animate-pulse" /> : vendors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Store className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">No vendors yet.</p></div>
      ) : (
        <Card><CardContent className="p-0">
          <div className="divide-y divide-border">
            {vendors.map((v) => (
              <div key={v.id} className="px-5 py-4 flex items-center gap-4" data-testid={`row-vendor-${v.id}`}>
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0"><Store className="w-4 h-4 text-amber-700" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.specialty}{v.phone ? ` · ${v.phone}` : ""}{v.email ? ` · ${v.email}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{v.active ? "Active" : "Inactive"}</span>
                  <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleOpenEdit(v)} data-testid={`button-edit-vendor-${v.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditVendor(null); setForm({ name: "", specialty: "", phone: "", email: "" }); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editVendor ? "Edit Vendor Details" : "Add Vendor"}</DialogTitle></DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Company Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></div>
              <div className="space-y-1.5"><Label>Specialty</Label><Input value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} required placeholder="e.g. Plumbing" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <Button type="submit" className="w-full">
              {editVendor ? "Save Vendor Changes" : "Add Vendor"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
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
        <div className="text-center py-12 text-muted-foreground"><Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">No work orders.</p></div>
      ) : (
        <Card><CardContent className="p-0">
          <div className="divide-y divide-border">
            {workOrders.map((wo) => (
              <div key={wo.id} className="px-5 py-4 flex items-start gap-4" data-testid={`row-work-order-board-${wo.id}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{wo.title}</p>
                  <p className="text-xs text-muted-foreground">{wo.resident_name} · Unit {wo.unit} · {wo.category} · <span className="capitalize">{wo.priority}</span> priority</p>
                  {wo.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{wo.description}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Select value={wo.status} onValueChange={(val) => updateWO.mutate({ id: wo.id, data: { status: val as "submitted" | "in-progress" | "completed" | "cancelled" } })}>
                    <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-wo-status-${wo.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => handleOpenEdit(wo)} data-testid={`button-edit-wo-${wo.id}`} title="Edit Work Order">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>

                  <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteWO(wo)} data-testid={`button-delete-wo-${wo.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
       </CardContent></Card>
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
            <Button type="submit" className="w-full" disabled={updateWO.isPending}>{updateWO.isPending ? "Saving..." : "Save Work Order Changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteWO} onOpenChange={(o) => { if (!o) setDeleteWO(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Work Order</AlertDialogTitle><AlertDialogDescription>Delete "{deleteWO?.title}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteWO && deleteWOmut.mutate({ id: deleteWO.id })} data-testid="button-confirm-delete-wo">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
