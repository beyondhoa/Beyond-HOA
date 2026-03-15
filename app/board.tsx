import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/query-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface BoardMember { name: string; role: string; since: string; }
interface VoteOption { id: string; label: string; votes: number; }
interface Vote { id: string; title: string; description: string; status: "active" | "closed"; deadline: string; options: VoteOption[]; userVote: string | null; totalVoters: number; }
interface ActionItem { id: string; title: string; priority: "high" | "medium" | "low"; category: string; }
interface WorkOrder {
  id: number;
  title: string;
  resident_name: string;
  unit: string;
  category: string;
  priority: string;
  description: string;
  status: "submitted" | "in-progress" | "completed" | "cancelled";
  board_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Violation {
  id: number;
  resident_name: string;
  unit: string;
  violation_type: string;
  notice_number: number;
  incident_date: string;
  description: string;
  required_action: string;
  compliance_deadline: string;
  fine_amount: string | null;
  status: "open" | "resolved" | "appealed";
  notes: string | null;
  issued_by: string | null;
  created_at: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  pinned: boolean;
  category: "general" | "maintenance" | "event" | "urgent";
}

interface Resident {
  id: number;
  resident_type: "owner" | "tenant";
}

const HOA_ANNOUNCEMENTS_KEY = "hoa_announcements";

const ANNOUNCE_CATEGORIES: { key: Announcement["category"]; label: string; icon: string; color: string }[] = [
  { key: "general",     label: "General",     icon: "information-circle", color: Colors.navy },
  { key: "maintenance", label: "Maintenance",  icon: "construct",          color: Colors.warning },
  { key: "event",       label: "Event",        icon: "calendar",           color: Colors.success },
  { key: "urgent",      label: "Urgent",       icon: "alert-circle",       color: Colors.danger },
];

const EMPTY_ANNOUNCE: { title: string; body: string; category: Announcement["category"]; pinned: boolean } = {
  title: "", body: "", category: "general", pinned: false,
};

const BOARD_MEMBERS: BoardMember[] = [
  { name: "Patricia Chen", role: "President", since: "2023" },
  { name: "Marcus Williams", role: "Vice President", since: "2024" },
  { name: "Sandra Torres", role: "Treasurer", since: "2022" },
  { name: "David Kim", role: "Secretary", since: "2024" },
  { name: "Rachel Moore", role: "Member at Large", since: "2023" },
];

const ACTION_ITEMS: ActionItem[] = [
  { id: "1", title: "Review pool maintenance bid", priority: "high", category: "Facilities" },
  { id: "2", title: "Approve 3 architectural requests", priority: "high", category: "Approvals" },
  { id: "3", title: "Q1 financial review", priority: "medium", category: "Finance" },
  { id: "4", title: "Schedule spring cleanup event", priority: "medium", category: "Events" },
  { id: "5", title: "Update website contact info", priority: "low", category: "Admin" },
  { id: "6", title: "Renew landscaping contract", priority: "medium", category: "Contracts" },
];

const priorityConfig = {
  high: { color: Colors.danger, label: "High" },
  medium: { color: Colors.warning, label: "Medium" },
  low: { color: Colors.success, label: "Low" },
};

const VIOLATION_TYPES = [
  "Landscaping / Lawn Care",
  "Parking Violation",
  "Noise / Nuisance",
  "Pet Policy",
  "Architectural Modification",
  "Trash / Debris",
  "Common Area Misuse",
  "Short-Term Rental",
  "Other",
];

const EMPTY_FORM = {
  resident_name: "",
  unit: "",
  violation_type: "Landscaping / Lawn Care",
  notice_number: 1,
  incident_date: "",
  description: "",
  required_action: "",
  compliance_deadline: "",
  fine_amount: "",
  issued_by: "",
  notes: "",
};

function apiRequest(method: string, path: string, body?: object) {
  const url = new URL(path, getApiUrl()).toString();
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function deadlineStr(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const statusConfig = {
  open: { color: Colors.danger, bg: Colors.danger + "18", label: "Open" },
  resolved: { color: Colors.success, bg: Colors.success + "18", label: "Resolved" },
  appealed: { color: Colors.warning, bg: Colors.warning + "18", label: "Appealed" },
};

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [violationModal, setViolationModal] = useState(false);
  const [detailViolation, setDetailViolation] = useState<Violation | null>(null);
  const [detailWorkOrder, setDetailWorkOrder] = useState<WorkOrder | null>(null);
  const [confirmDeleteWo, setConfirmDeleteWo] = useState(false);
  const [boardNotesDraft, setBoardNotesDraft] = useState("");
  const [announceModal, setAnnounceModal] = useState(false);
  const [announceForm, setAnnounceForm] = useState({ ...EMPTY_ANNOUNCE });
  const [announceSaving, setAnnounceSaving] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [ballotModal, setBallotModal] = useState(false);
  const [ballotForm, setBallotForm] = useState({ title: "", description: "", deadline: "", options: ["Yes", "No", ""], totalVoters: 248 });
  const [ballotSaving, setBallotSaving] = useState(false);
  const [noticeModal, setNoticeModal] = useState(false);
  const [noticeForm, setNoticeForm] = useState<{ subject: string; body: string; recipients: "all" | "owners" | "tenants"; category: "general" | "maintenance" | "urgent" | "legal" }>({ subject: "", body: "", recipients: "all", category: "general" });
  const [noticeSending, setNoticeSending] = useState(false);
  const [woListModal, setWoListModal] = useState(false);
  const [woListFilter, setWoListFilter] = useState<"all" | "submitted" | "in-progress" | "completed" | "cancelled">("all");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const queryClient = useQueryClient();

  const { data: violations = [] } = useQuery<Violation[]>({ queryKey: ["/api/violations"] });
  const { data: workOrders = [] } = useQuery<WorkOrder[]>({ queryKey: ["/api/work-orders"] });
  const { data: residents = [] } = useQuery<Resident[]>({ queryKey: ["/api/residents"] });

  const saveAnnouncement = async () => {
    if (!announceForm.title.trim() || !announceForm.body.trim()) {
      Alert.alert("Required Fields", "Please enter a title and body.");
      return;
    }
    setAnnounceSaving(true);
    try {
      const stored = await AsyncStorage.getItem(HOA_ANNOUNCEMENTS_KEY);
      const existing: Announcement[] = stored ? JSON.parse(stored) : [];
      const newItem: Announcement = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        title: announceForm.title.trim(),
        body: announceForm.body.trim(),
        category: announceForm.category,
        pinned: announceForm.pinned,
        date: new Date().toISOString().split("T")[0],
      };
      const updated = announceForm.pinned
        ? [newItem, ...existing.map((a) => ({ ...a, pinned: false }))]
        : [newItem, ...existing];
      await AsyncStorage.setItem(HOA_ANNOUNCEMENTS_KEY, JSON.stringify(updated));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAnnounceModal(false);
      setAnnounceForm({ ...EMPTY_ANNOUNCE });
    } catch {
      Alert.alert("Error", "Failed to save announcement.");
    } finally {
      setAnnounceSaving(false);
    }
  };

  const updateWorkOrder = useMutation({
    mutationFn: ({ id, status, board_notes }: { id: number; status?: string; board_notes?: string }) =>
      apiRequest("PUT", `/api/work-orders/${id}`, { status, board_notes }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setDetailWorkOrder(updated);
    },
  });

  const deleteWorkOrder = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/work-orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setConfirmDeleteWo(false);
      setDetailWorkOrder(null);
    },
    onError: () => Alert.alert("Error", "Failed to delete work order."),
  });

  const handleDeleteWorkOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setConfirmDeleteWo(true);
  };

  const createViolation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      apiRequest("POST", "/api/violations", {
        ...data,
        fine_amount: data.fine_amount ? parseFloat(data.fine_amount) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/violations"] });
      setViolationModal(false);
      setForm({ ...EMPTY_FORM });
      Alert.alert("Notice Filed", "Violation notice has been logged successfully.");
    },
    onError: () => Alert.alert("Error", "Failed to file violation notice."),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/violations/${id}/status`, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/violations"] });
      setDetailViolation(updated);
    },
  });

  const deleteViolation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/violations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/violations"] });
      setDetailViolation(null);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/violations"] });
    setRefreshing(false);
  }, [queryClient]);

  const adminTools = [
    { id: "announce", icon: "megaphone", label: "New Announcement", color: Colors.navy },
    { id: "vote", icon: "checkmark-circle", label: "Create Ballot", color: "#7C3AED" },
    { id: "notice", icon: "mail", label: "Send Notice", color: Colors.warning },
    { id: "violation", icon: "alert-circle", label: "Log Violation", color: Colors.danger },
    { id: "maintenance", icon: "construct", label: "Work Order", color: "#0891B2" },
    { id: "report", icon: "bar-chart", label: "Generate Report", color: Colors.success },
  ];

  const handleToolPress = (tool: typeof adminTools[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (tool.id === "violation") {
      setForm({ ...EMPTY_FORM, incident_date: todayStr(), compliance_deadline: deadlineStr(14) });
      setViolationModal(true);
    } else if (tool.id === "announce") {
      setAnnounceForm({ ...EMPTY_ANNOUNCE });
      setAnnounceModal(true);
    } else if (tool.id === "report") {
      setReportModal(true);
    } else if (tool.id === "vote") {
      setBallotForm({ title: "", description: "", deadline: deadlineStr(14), options: ["Yes", "No", ""], totalVoters: residents.length || 248 });
      setBallotModal(true);
    } else if (tool.id === "notice") {
      setNoticeForm({ subject: "", body: "", recipients: "all", category: "general" });
      setNoticeModal(true);
    } else if (tool.id === "maintenance") {
      setWoListFilter("all");
      setWoListModal(true);
    }
  };

  const toggleItem = (id: string) => {
    Haptics.selectionAsync();
    setCompletedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!form.resident_name.trim() || !form.unit.trim() || !form.incident_date || !form.description.trim() || !form.required_action.trim() || !form.compliance_deadline) {
      Alert.alert("Required Fields", "Please fill in all required fields.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createViolation.mutate(form);
  };

  const saveBallot = async () => {
    if (!ballotForm.title.trim() || !ballotForm.description.trim() || !ballotForm.deadline) {
      Alert.alert("Required Fields", "Please fill in title, description, and deadline.");
      return;
    }
    const nonEmpty = ballotForm.options.filter((o) => o.trim());
    if (nonEmpty.length < 2) {
      Alert.alert("Options Required", "Please add at least 2 voting options.");
      return;
    }
    setBallotSaving(true);
    try {
      const stored = await AsyncStorage.getItem("hoa_votes");
      const existing: Vote[] = stored ? JSON.parse(stored) : [];
      const newBallot: Vote = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        title: ballotForm.title.trim(),
        description: ballotForm.description.trim(),
        status: "active",
        deadline: ballotForm.deadline,
        options: nonEmpty.map((label, i) => ({ id: `opt_${i}`, label: label.trim(), votes: 0 })),
        userVote: null,
        totalVoters: ballotForm.totalVoters,
      };
      await AsyncStorage.setItem("hoa_votes", JSON.stringify([newBallot, ...existing]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBallotModal(false);
      Alert.alert("Ballot Published", `"${newBallot.title}" is now live for community voting.`);
    } catch {
      Alert.alert("Error", "Failed to publish ballot.");
    } finally {
      setBallotSaving(false);
    }
  };

  const sendNotice = async () => {
    if (!noticeForm.subject.trim() || !noticeForm.body.trim()) {
      Alert.alert("Required Fields", "Please enter a subject and message body.");
      return;
    }
    setNoticeSending(true);
    try {
      const stored = await AsyncStorage.getItem("hoa_notices");
      const existing = stored ? JSON.parse(stored) : [];
      const notice = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        subject: noticeForm.subject.trim(),
        body: noticeForm.body.trim(),
        recipients: noticeForm.recipients,
        category: noticeForm.category,
        sentAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem("hoa_notices", JSON.stringify([notice, ...existing]));
      const announceStored = await AsyncStorage.getItem(HOA_ANNOUNCEMENTS_KEY);
      const announceExisting: Announcement[] = announceStored ? JSON.parse(announceStored) : [];
      const catMap: Record<string, Announcement["category"]> = { urgent: "urgent", maintenance: "maintenance", general: "general", legal: "general" };
      const newItem: Announcement = {
        id: notice.id,
        title: noticeForm.subject.trim(),
        body: noticeForm.body.trim(),
        category: catMap[noticeForm.category] ?? "general",
        pinned: noticeForm.category === "urgent",
        date: new Date().toISOString().split("T")[0],
      };
      const updatedAnnouncements = noticeForm.category === "urgent"
        ? [newItem, ...announceExisting.map((a) => ({ ...a, pinned: false }))]
        : [newItem, ...announceExisting];
      await AsyncStorage.setItem(HOA_ANNOUNCEMENTS_KEY, JSON.stringify(updatedAnnouncements));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNoticeModal(false);
      const recipLabel = noticeForm.recipients === "all" ? "All Residents" : noticeForm.recipients === "owners" ? "Owners Only" : "Tenants Only";
      Alert.alert("Notice Sent", `Your notice has been sent to ${recipLabel} and posted on the home screen.`);
    } catch {
      Alert.alert("Error", "Failed to send notice.");
    } finally {
      setNoticeSending(false);
    }
  };

  const handleDeleteViolation = (v: Violation) => {
    Alert.alert("Delete Notice", `Delete violation notice for ${v.resident_name} (Unit ${v.unit})?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); deleteViolation.mutate(v.id); },
      },
    ]);
  };

  const pendingCount = ACTION_ITEMS.length - completedItems.length;
  const openViolations = violations.filter((v) => v.status === "open").length;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-down" size={22} color={Colors.slate} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="shield-star" size={16} color={Colors.gold} />
          <Text style={styles.headerTitle}>Board Dashboard</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>BEYOND HOA</Text>
              <Text style={styles.heroTitle}>Board Portal</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>2026</Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>247</Text>
              <Text style={styles.heroStatLabel}>Units</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>94%</Text>
              <Text style={styles.heroStatLabel}>Dues Collected</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{openViolations}</Text>
              <Text style={styles.heroStatLabel}>Open Violations</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.toolsGrid}>
            {adminTools.map((tool) => (
              <TouchableOpacity
                key={tool.id}
                style={styles.toolCard}
                onPress={() => handleToolPress(tool)}
                activeOpacity={0.75}
              >
                <View style={[styles.toolIcon, { backgroundColor: tool.color + "18" }]}>
                  <Ionicons name={tool.icon as any} size={22} color={tool.color} />
                </View>
                <Text style={styles.toolLabel}>{tool.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Work Orders</Text>
            {workOrders.filter((w) => w.status === "submitted").length > 0 && (
              <View style={[styles.badge, { backgroundColor: "#0891B218" }]}>
                <Text style={[styles.badgeText, { color: "#0891B2" }]}>
                  {workOrders.filter((w) => w.status === "submitted").length} new
                </Text>
              </View>
            )}
          </View>

          {workOrders.length === 0 ? (
            <View style={styles.emptyViolations}>
              <Ionicons name="construct-outline" size={32} color={Colors.border} />
              <Text style={styles.emptyViolationsText}>No work orders submitted</Text>
            </View>
          ) : (
            workOrders.slice(0, 5).map((wo) => {
              const priorityColors: Record<string, string> = {
                low: Colors.success, medium: Colors.warning, high: Colors.danger, emergency: "#7C0000",
              };
              const woStatusConf: Record<string, { color: string; bg: string; label: string }> = {
                submitted:    { color: "#3B82F6", bg: "#EFF6FF", label: "New" },
                "in-progress": { color: Colors.warning, bg: Colors.warning + "15", label: "In Progress" },
                completed:    { color: Colors.success, bg: Colors.success + "18", label: "Completed" },
                cancelled:    { color: Colors.slate, bg: Colors.slate + "18", label: "Cancelled" },
              };
              const sc = woStatusConf[wo.status] ?? woStatusConf.submitted;
              const pc = priorityColors[wo.priority] ?? Colors.slate;
              return (
                <TouchableOpacity
                  key={wo.id}
                  style={styles.violationCard}
                  onPress={() => { setBoardNotesDraft(wo.board_notes ?? ""); setDetailWorkOrder(wo); }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.violationTypeDot, { backgroundColor: pc }]} />
                  <View style={styles.violationBody}>
                    <View style={styles.violationTop}>
                      <Text style={styles.violationName} numberOfLines={1}>{wo.title}</Text>
                      <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.violationType}>{wo.resident_name} · Unit {wo.unit} · {wo.category}</Text>
                    <Text style={styles.violationDate}>
                      Submitted: {new Date(wo.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Violation Log</Text>
            {openViolations > 0 && (
              <View style={[styles.badge, { backgroundColor: Colors.danger + "18" }]}>
                <Text style={[styles.badgeText, { color: Colors.danger }]}>{openViolations} open</Text>
              </View>
            )}
          </View>

          {violations.length === 0 ? (
            <View style={styles.emptyViolations}>
              <Ionicons name="checkmark-circle-outline" size={32} color={Colors.border} />
              <Text style={styles.emptyViolationsText}>No violations on record</Text>
            </View>
          ) : (
            violations.slice(0, 5).map((v) => {
              const sc = statusConfig[v.status] ?? statusConfig.open;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={styles.violationCard}
                  onPress={() => setDetailViolation(v)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.violationTypeDot, { backgroundColor: sc.color }]} />
                  <View style={styles.violationBody}>
                    <View style={styles.violationTop}>
                      <Text style={styles.violationName} numberOfLines={1}>
                        {v.resident_name} · Unit {v.unit}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.violationType}>{v.violation_type}</Text>
                    <View style={styles.violationMeta}>
                      <Text style={styles.violationDate}>Incident: {fmtDate(v.incident_date)}</Text>
                      {v.fine_amount && (
                        <Text style={styles.violationFine}>${parseFloat(v.fine_amount).toFixed(2)} fine</Text>
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity
            style={styles.logViolationBtn}
            onPress={() => { setForm({ ...EMPTY_FORM, incident_date: todayStr(), compliance_deadline: deadlineStr(14) }); setViolationModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={16} color={Colors.danger} />
            <Text style={styles.logViolationBtnText}>File New Violation Notice</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Action Items</Text>
            <View style={[styles.badge, { backgroundColor: pendingCount > 0 ? Colors.danger + "18" : Colors.success + "18" }]}>
              <Text style={[styles.badgeText, { color: pendingCount > 0 ? Colors.danger : Colors.success }]}>
                {pendingCount} pending
              </Text>
            </View>
          </View>

          {ACTION_ITEMS.map((item) => {
            const done = completedItems.includes(item.id);
            const priority = priorityConfig[item.priority];
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.actionItem, done && styles.actionItemDone]}
                onPress={() => toggleItem(item.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.checkBox, done && styles.checkBoxDone]}>
                  {done && <Ionicons name="checkmark" size={13} color="#fff" />}
                </View>
                <View style={styles.actionItemContent}>
                  <Text style={[styles.actionItemTitle, done && styles.actionItemTitleDone]}>{item.title}</Text>
                  <Text style={styles.actionItemCategory}>{item.category}</Text>
                </View>
                <View style={[styles.priorityDot, { backgroundColor: priority.color + "30" }]}>
                  <Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Board Members</Text>
          {BOARD_MEMBERS.map((member, idx) => (
            <View key={idx} style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitials}>
                  {member.name.split(" ").map((n) => n[0]).join("")}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberRole}>{member.role}</Text>
              </View>
              <Text style={styles.memberSince}>Since {member.since}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.meetingCard}>
            <View style={styles.meetingIconWrap}>
              <Ionicons name="calendar" size={22} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.meetingLabel}>Next Board Meeting</Text>
              <Text style={styles.meetingDate}>March 20, 2026 · 7:00 PM</Text>
              <Text style={styles.meetingLocation}>Community Center – Room A</Text>
            </View>
            <TouchableOpacity
              style={styles.meetingBtn}
              onPress={() => { Haptics.selectionAsync(); Alert.alert("Meeting Agenda", "Agenda will be distributed 7 days before the meeting."); }}
              activeOpacity={0.8}
            >
              <Text style={styles.meetingBtnText}>Agenda</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: bottomPadding + 20 }} />
      </ScrollView>

      <Modal visible={!!detailWorkOrder} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setDetailWorkOrder(null); setConfirmDeleteWo(false); }}>
        {detailWorkOrder && (() => {
          const woStatusConf: Record<string, { color: string; bg: string; label: string }> = {
            submitted:     { color: "#3B82F6", bg: "#EFF6FF", label: "New" },
            "in-progress": { color: Colors.warning, bg: Colors.warning + "15", label: "In Progress" },
            completed:     { color: Colors.success, bg: Colors.success + "18", label: "Completed" },
            cancelled:     { color: Colors.slate, bg: Colors.slate + "18", label: "Cancelled" },
          };
          const priorityColors: Record<string, string> = { low: Colors.success, medium: Colors.warning, high: Colors.danger, emergency: "#7C0000" };
          const sc = woStatusConf[detailWorkOrder.status] ?? woStatusConf.submitted;
          const priorityLabel: Record<string, string> = { low: "Low", medium: "Medium", high: "High", emergency: "Emergency" };
          return (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setDetailWorkOrder(null)} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={20} color={Colors.text} />
                  </TouchableOpacity>
                  <View style={styles.modalTitleWrap}>
                    <Ionicons name="construct" size={16} color="#0891B2" />
                    <Text style={styles.modalTitle}>Work Order #{detailWorkOrder.id}</Text>
                  </View>
                  <TouchableOpacity onPress={handleDeleteWorkOrder} style={styles.modalCloseBtn} testID={`delete-wo-${detailWorkOrder.id}`}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.detailScroll} keyboardShouldPersistTaps="handled">
                  <View style={styles.noticeBanner}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noticeBannerTitle}>{detailWorkOrder.title}</Text>
                      <Text style={styles.noticeBannerSub}>
                        {detailWorkOrder.resident_name} · Unit {detailWorkOrder.unit} · Submitted {fmtDate(detailWorkOrder.created_at)}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                  </View>

                  <View style={styles.detailCard}>
                    <NoticeRow label="Category" value={detailWorkOrder.category} />
                    <NoticeRow label="Priority" value={priorityLabel[detailWorkOrder.priority] ?? detailWorkOrder.priority} highlight={detailWorkOrder.priority === "emergency" || detailWorkOrder.priority === "high"} />
                    <NoticeRow label="Unit" value={`Unit ${detailWorkOrder.unit}`} />
                    <NoticeRow label="Submitted" value={fmtDate(detailWorkOrder.created_at)} />
                    {detailWorkOrder.updated_at !== detailWorkOrder.created_at && (
                      <NoticeRow label="Last Updated" value={fmtDate(detailWorkOrder.updated_at)} />
                    )}
                  </View>

                  <View style={styles.noticeSection}>
                    <Text style={styles.noticeSectionLabel}>DESCRIPTION</Text>
                    <Text style={styles.noticeSectionText}>{detailWorkOrder.description}</Text>
                  </View>

                  <View style={styles.noticeSection}>
                    <Text style={styles.noticeSectionLabel}>UPDATE STATUS</Text>
                    <View style={styles.statusRow}>
                      {(["submitted", "in-progress", "completed", "cancelled"] as const).map((s) => {
                        const c = woStatusConf[s];
                        return (
                          <TouchableOpacity
                            key={s}
                            style={[styles.statusBtn, detailWorkOrder.status === s && { backgroundColor: c.bg, borderColor: c.color }]}
                            onPress={() => { Haptics.selectionAsync(); updateWorkOrder.mutate({ id: detailWorkOrder.id, status: s }); }}
                            disabled={updateWorkOrder.isPending}
                          >
                            <Text style={[styles.statusBtnText, detailWorkOrder.status === s && { color: c.color }]}>{c.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.noticeSection}>
                    <Text style={styles.noticeSectionLabel}>BOARD NOTES</Text>
                    <TextInput
                      style={[styles.vInput, styles.vInputMulti, { marginBottom: 10 }]}
                      value={boardNotesDraft}
                      onChangeText={setBoardNotesDraft}
                      placeholder="Add internal notes for the board..."
                      placeholderTextColor={Colors.slate}
                      multiline
                      numberOfLines={3}
                    />
                    <TouchableOpacity
                      style={[styles.modalSaveBtn, { alignSelf: "flex-end" }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateWorkOrder.mutate({ id: detailWorkOrder.id, board_notes: boardNotesDraft }); }}
                      disabled={updateWorkOrder.isPending}
                    >
                      <Text style={styles.modalSaveBtnText}>Save Notes</Text>
                    </TouchableOpacity>
                  </View>

                  {confirmDeleteWo ? (
                    <View style={styles.deleteConfirmBox} testID="delete-confirm-box">
                      <Ionicons name="warning" size={18} color={Colors.danger} />
                      <Text style={styles.deleteConfirmText}>Permanently delete this work order?</Text>
                      <View style={styles.deleteConfirmBtns}>
                        <TouchableOpacity
                          style={styles.deleteConfirmCancel}
                          onPress={() => setConfirmDeleteWo(false)}
                          testID="cancel-delete-wo"
                        >
                          <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteConfirmYes}
                          onPress={() => deleteWorkOrder.mutate(detailWorkOrder.id)}
                          disabled={deleteWorkOrder.isPending}
                          testID="confirm-delete-wo"
                        >
                          <Text style={styles.deleteConfirmYesText}>{deleteWorkOrder.isPending ? "Deleting…" : "Delete"}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.deleteWoBtn}
                      onPress={handleDeleteWorkOrder}
                      testID="delete-wo-button"
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      <Text style={styles.deleteWoBtnText}>Delete Work Order</Text>
                    </TouchableOpacity>
                  )}

                  <View style={{ height: 32 }} />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          );
        })()}
      </Modal>

      {/* ── NEW ANNOUNCEMENT MODAL ─────────────────────────── */}
      <Modal visible={announceModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAnnounceModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setAnnounceModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="megaphone" size={16} color={Colors.navy} />
                <Text style={styles.modalTitle}>New Announcement</Text>
              </View>
              <TouchableOpacity onPress={saveAnnouncement} style={[styles.modalSaveBtn, { backgroundColor: Colors.navy }]} disabled={announceSaving}>
                {announceSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalSaveBtnText}>Post</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.noticeBanner}>
                <Ionicons name="megaphone" size={18} color={Colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noticeBannerTitle}>Community Announcement</Text>
                  <Text style={styles.noticeBannerSub}>Posted to the resident dashboard immediately.</Text>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>ANNOUNCEMENT DETAILS</Text>
                <Text style={styles.vLabel}>Title *</Text>
                <TextInput
                  style={styles.vInput}
                  value={announceForm.title}
                  onChangeText={(v) => setAnnounceForm({ ...announceForm, title: v })}
                  placeholder="e.g. Pool Closure – Scheduled Maintenance"
                  placeholderTextColor={Colors.slate}
                />
                <Text style={styles.vLabel}>Message *</Text>
                <TextInput
                  style={[styles.vInput, styles.vInputMulti]}
                  value={announceForm.body}
                  onChangeText={(v) => setAnnounceForm({ ...announceForm, body: v })}
                  placeholder="Write the full announcement message here…"
                  placeholderTextColor={Colors.slate}
                  multiline
                  numberOfLines={5}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>CATEGORY</Text>
                <View style={styles.categoryGrid}>
                  {ANNOUNCE_CATEGORIES.map((cat) => {
                    const active = announceForm.category === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[styles.categoryChip, active && { backgroundColor: cat.color + "18", borderColor: cat.color }]}
                        onPress={() => { Haptics.selectionAsync(); setAnnounceForm({ ...announceForm, category: cat.key }); }}
                      >
                        <Ionicons name={cat.icon as any} size={15} color={active ? cat.color : Colors.slate} />
                        <Text style={[styles.categoryChipText, active && { color: cat.color }]}>{cat.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formSection}>
                <View style={styles.pinnedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pinnedLabel}>Pin to top</Text>
                    <Text style={styles.pinnedSub}>Appears first in the announcements feed. Unpins any existing pinned notice.</Text>
                  </View>
                  <Switch
                    value={announceForm.pinned}
                    onValueChange={(v) => { Haptics.selectionAsync(); setAnnounceForm({ ...announceForm, pinned: v }); }}
                    trackColor={{ false: Colors.border, true: Colors.navy + "88" }}
                    thumbColor={announceForm.pinned ? Colors.navy : "#f4f3f4"}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── GENERATE REPORT MODAL ──────────────────────────── */}
      <Modal visible={reportModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReportModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReportModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.modalTitleWrap}>
              <Ionicons name="bar-chart" size={16} color={Colors.success} />
              <Text style={styles.modalTitle}>Community Report</Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={[styles.detailScroll, { gap: 0 }]} showsVerticalScrollIndicator={false}>
            {/* Header band */}
            <View style={styles.reportBanner}>
              <Text style={styles.reportBannerTitle}>Beyond HOA — Status Report</Text>
              <Text style={styles.reportBannerDate}>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</Text>
            </View>

            {/* Residents */}
            <View style={styles.reportSection}>
              <View style={styles.reportSectionHeader}>
                <Ionicons name="people" size={15} color={Colors.navy} />
                <Text style={styles.reportSectionTitle}>RESIDENTS</Text>
              </View>
              <View style={styles.reportRow}>
                <ReportStat label="Total Residents" value={residents.length} />
                <ReportStat label="Owners" value={residents.filter((r) => r.resident_type === "owner").length} color={Colors.gold} />
                <ReportStat label="Tenants" value={residents.filter((r) => r.resident_type === "tenant").length} color="#3B82F6" />
              </View>
            </View>

            {/* Work Orders */}
            {(() => {
              const total = workOrders.length;
              const byStatus: Record<string, number> = {};
              workOrders.forEach((w) => { byStatus[w.status] = (byStatus[w.status] ?? 0) + 1; });
              const byCat: Record<string, number> = {};
              workOrders.forEach((w) => { byCat[w.category] = (byCat[w.category] ?? 0) + 1; });
              const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);
              return (
                <View style={styles.reportSection}>
                  <View style={styles.reportSectionHeader}>
                    <Ionicons name="construct" size={15} color="#0891B2" />
                    <Text style={styles.reportSectionTitle}>WORK ORDERS</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <ReportStat label="Total" value={total} />
                    <ReportStat label="New" value={byStatus["submitted"] ?? 0} color="#3B82F6" />
                    <ReportStat label="In Progress" value={byStatus["in-progress"] ?? 0} color={Colors.warning} />
                    <ReportStat label="Completed" value={byStatus["completed"] ?? 0} color={Colors.success} />
                  </View>
                  {topCats.length > 0 && (
                    <View style={styles.reportBars}>
                      <Text style={styles.reportBarsTitle}>Top Categories</Text>
                      {topCats.map(([cat, count]) => (
                        <View key={cat} style={styles.reportBarRow}>
                          <Text style={styles.reportBarLabel}>{cat}</Text>
                          <View style={styles.reportBarTrack}>
                            <View style={[styles.reportBarFill, { width: `${Math.round((count / total) * 100)}%`, backgroundColor: "#0891B2" }]} />
                          </View>
                          <Text style={styles.reportBarValue}>{count}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Violations */}
            {(() => {
              const total = violations.length;
              const open = violations.filter((v) => v.status === "open").length;
              const resolved = violations.filter((v) => v.status === "resolved").length;
              const appealed = violations.filter((v) => v.status === "appealed").length;
              const byType: Record<string, number> = {};
              violations.forEach((v) => { byType[v.violation_type] = (byType[v.violation_type] ?? 0) + 1; });
              const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 4);
              return (
                <View style={styles.reportSection}>
                  <View style={styles.reportSectionHeader}>
                    <Ionicons name="alert-circle" size={15} color={Colors.danger} />
                    <Text style={styles.reportSectionTitle}>VIOLATIONS</Text>
                  </View>
                  <View style={styles.reportRow}>
                    <ReportStat label="Total" value={total} />
                    <ReportStat label="Open" value={open} color={Colors.danger} />
                    <ReportStat label="Resolved" value={resolved} color={Colors.success} />
                    <ReportStat label="Appealed" value={appealed} color={Colors.warning} />
                  </View>
                  {topTypes.length > 0 && (
                    <View style={styles.reportBars}>
                      <Text style={styles.reportBarsTitle}>By Violation Type</Text>
                      {topTypes.map(([type, count]) => (
                        <View key={type} style={styles.reportBarRow}>
                          <Text style={styles.reportBarLabel}>{type}</Text>
                          <View style={styles.reportBarTrack}>
                            <View style={[styles.reportBarFill, { width: `${Math.round((count / total) * 100)}%`, backgroundColor: Colors.danger }]} />
                          </View>
                          <Text style={styles.reportBarValue}>{count}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Dues */}
            <View style={styles.reportSection}>
              <View style={styles.reportSectionHeader}>
                <Ionicons name="cash" size={15} color={Colors.success} />
                <Text style={styles.reportSectionTitle}>DUES COLLECTION — Q1 2026</Text>
              </View>
              <View style={styles.reportRow}>
                <ReportStat label="Collected" value="94%" color={Colors.success} />
                <ReportStat label="Outstanding" value="6%" color={Colors.danger} />
                <ReportStat label="Units" value="247" />
              </View>
              <View style={styles.reportBars}>
                <View style={styles.reportBarRow}>
                  <Text style={styles.reportBarLabel}>Collection Rate</Text>
                  <View style={styles.reportBarTrack}>
                    <View style={[styles.reportBarFill, { width: "94%", backgroundColor: Colors.success }]} />
                  </View>
                  <Text style={styles.reportBarValue}>94%</Text>
                </View>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={violationModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setViolationModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setViolationModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text style={styles.modalTitle}>Violation Notice</Text>
              </View>
              <TouchableOpacity onPress={handleSave} style={styles.modalSaveBtn} disabled={createViolation.isPending}>
                {createViolation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalSaveBtnText}>File</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.noticeBanner}>
                <MaterialCommunityIcons name="file-document-edit-outline" size={18} color={Colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noticeBannerTitle}>Beyond HOA — Official Violation Notice</Text>
                  <Text style={styles.noticeBannerSub}>This notice will be logged in the violation record.</Text>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>RESIDENT INFORMATION</Text>
                <VField label="Resident Name *" value={form.resident_name} onChangeText={(v) => setForm({ ...form, resident_name: v })} placeholder="Full name" />
                <VField label="Unit Number *" value={form.unit} onChangeText={(v) => setForm({ ...form, unit: v })} placeholder="e.g. 102" />
                <VField label="Issued By" value={form.issued_by} onChangeText={(v) => setForm({ ...form, issued_by: v })} placeholder="Board member name" />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>VIOLATION DETAILS</Text>

                <Text style={styles.vLabel}>Violation Type *</Text>
                <TouchableOpacity style={styles.typeSelector} onPress={() => setTypePickerOpen(!typePickerOpen)} activeOpacity={0.8}>
                  <Text style={styles.typeSelectorText}>{form.violation_type}</Text>
                  <Ionicons name={typePickerOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.slate} />
                </TouchableOpacity>
                {typePickerOpen && (
                  <View style={styles.typePicker}>
                    {VIOLATION_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeOption, form.violation_type === t && styles.typeOptionActive]}
                        onPress={() => { setForm({ ...form, violation_type: t }); setTypePickerOpen(false); }}
                      >
                        <Text style={[styles.typeOptionText, form.violation_type === t && styles.typeOptionTextActive]}>{t}</Text>
                        {form.violation_type === t && <Ionicons name="checkmark" size={14} color={Colors.gold} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={styles.vLabel}>Notice Number *</Text>
                <View style={styles.toggleRow}>
                  {[1, 2, 3].map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.toggleBtn, form.notice_number === n && styles.toggleActive]}
                      onPress={() => setForm({ ...form, notice_number: n })}
                    >
                      <Text style={[styles.toggleText, form.notice_number === n && styles.toggleTextActive]}>
                        {n === 1 ? "1st Notice" : n === 2 ? "2nd Notice" : "3rd Notice"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <VField label="Date of Incident *" value={form.incident_date} onChangeText={(v) => setForm({ ...form, incident_date: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                <VField label="Violation Description *" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Describe the specific violation observed..." multiline />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>CORRECTIVE ACTION</Text>
                <VField label="Required Action *" value={form.required_action} onChangeText={(v) => setForm({ ...form, required_action: v })} placeholder="Describe the steps the resident must take to resolve this violation..." multiline />
                <VField label="Compliance Deadline *" value={form.compliance_deadline} onChangeText={(v) => setForm({ ...form, compliance_deadline: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                <VField label="Fine Amount ($)" value={form.fine_amount} onChangeText={(v) => setForm({ ...form, fine_amount: v })} placeholder="0.00 (leave blank if no fine)" keyboardType="decimal-pad" />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>ADDITIONAL NOTES</Text>
                <VField label="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder="Any additional context or internal notes..." multiline />
              </View>

              <View style={styles.noticeFooter}>
                <Text style={styles.noticeFooterText}>
                  By filing this notice, it will be recorded in the community violation log and associated with the resident's account. Continued violations may result in escalated fines or legal action per the CC&Rs.
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!detailViolation} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailViolation(null)}>
        {detailViolation && (() => {
          const sc = statusConfig[detailViolation.status] ?? statusConfig.open;
          return (
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setDetailViolation(null)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Violation Notice</Text>
                <TouchableOpacity onPress={() => handleDeleteViolation(detailViolation)} style={styles.modalCloseBtn}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.detailScroll}>
                <View style={styles.noticeBanner}>
                  <MaterialCommunityIcons name="file-document-outline" size={18} color={Colors.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noticeBannerTitle}>Beyond HOA — Official Violation Notice</Text>
                    <Text style={styles.noticeBannerSub}>Filed {fmtDate(detailViolation.created_at)}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>

                <View style={styles.detailCard}>
                  <NoticeRow label="Resident" value={`${detailViolation.resident_name} · Unit ${detailViolation.unit}`} />
                  <NoticeRow label="Issued By" value={detailViolation.issued_by ?? "—"} />
                  <NoticeRow label="Violation Type" value={detailViolation.violation_type} />
                  <NoticeRow label="Notice Number" value={`${detailViolation.notice_number}${detailViolation.notice_number === 1 ? "st" : detailViolation.notice_number === 2 ? "nd" : "rd"} Notice`} />
                  <NoticeRow label="Date of Incident" value={fmtDate(detailViolation.incident_date)} />
                  <NoticeRow label="Compliance Deadline" value={fmtDate(detailViolation.compliance_deadline)} />
                  {detailViolation.fine_amount && (
                    <NoticeRow label="Fine Amount" value={`$${parseFloat(detailViolation.fine_amount).toFixed(2)}`} highlight />
                  )}
                </View>

                <View style={styles.noticeSection}>
                  <Text style={styles.noticeSectionLabel}>VIOLATION DESCRIPTION</Text>
                  <Text style={styles.noticeSectionText}>{detailViolation.description}</Text>
                </View>

                <View style={styles.noticeSection}>
                  <Text style={styles.noticeSectionLabel}>REQUIRED CORRECTIVE ACTION</Text>
                  <Text style={styles.noticeSectionText}>{detailViolation.required_action}</Text>
                </View>

                {detailViolation.notes && (
                  <View style={styles.noticeSection}>
                    <Text style={styles.noticeSectionLabel}>ADDITIONAL NOTES</Text>
                    <Text style={styles.noticeSectionText}>{detailViolation.notes}</Text>
                  </View>
                )}

                <View style={styles.noticeSection}>
                  <Text style={styles.noticeSectionLabel}>UPDATE STATUS</Text>
                  <View style={styles.statusRow}>
                    {(["open", "resolved", "appealed"] as const).map((s) => {
                      const c = statusConfig[s];
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.statusBtn, detailViolation.status === s && { backgroundColor: c.bg, borderColor: c.color }]}
                          onPress={() => { Haptics.selectionAsync(); updateStatus.mutate({ id: detailViolation.id, status: s }); }}
                          disabled={updateStatus.isPending}
                        >
                          <Text style={[styles.statusBtnText, detailViolation.status === s && { color: c.color }]}>{c.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.noticeFooter}>
                  <Text style={styles.noticeFooterText}>
                    This is an official violation notice issued by Beyond HOA. Failure to comply by the deadline may result in additional fines or enforcement action as outlined in the community CC&Rs.
                  </Text>
                </View>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>

      {/* ── CREATE BALLOT MODAL ── */}
      <Modal visible={ballotModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBallotModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setBallotModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="checkmark-circle" size={16} color="#7C3AED" />
                <Text style={styles.modalTitle}>Create Ballot</Text>
              </View>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: "#7C3AED" }, ballotSaving && { opacity: 0.6 }]}
                onPress={saveBallot}
                disabled={ballotSaving}
              >
                {ballotSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSaveBtnText}>Publish</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>BALLOT DETAILS</Text>
                <VField label="Ballot Title *" value={ballotForm.title} onChangeText={(v) => setBallotForm({ ...ballotForm, title: v })} placeholder="e.g. New Playground Equipment Approval" />
                <VField label="Description / Question *" value={ballotForm.description} onChangeText={(v) => setBallotForm({ ...ballotForm, description: v })} placeholder="Describe the issue and what members are voting on..." multiline />
                <VField label="Voting Deadline *" value={ballotForm.deadline} onChangeText={(v) => setBallotForm({ ...ballotForm, deadline: v })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                <Text style={styles.vLabel}>Total Eligible Voters</Text>
                <View style={styles.voterRow}>
                  <TouchableOpacity style={styles.voterBtn} onPress={() => setBallotForm({ ...ballotForm, totalVoters: Math.max(1, ballotForm.totalVoters - 1) })}>
                    <Ionicons name="remove" size={18} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.voterCount}>{ballotForm.totalVoters}</Text>
                  <TouchableOpacity style={styles.voterBtn} onPress={() => setBallotForm({ ...ballotForm, totalVoters: ballotForm.totalVoters + 1 })}>
                    <Ionicons name="add" size={18} color={Colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>VOTING OPTIONS</Text>
                <Text style={[styles.vLabel, { marginBottom: 10 }]}>Add between 2 and 4 options. Leave extra fields blank to skip.</Text>
                {ballotForm.options.map((opt, idx) => (
                  <View key={idx} style={styles.optionRow}>
                    <View style={styles.optionNum}>
                      <Text style={styles.optionNumText}>{String.fromCharCode(65 + idx)}</Text>
                    </View>
                    <TextInput
                      style={[styles.vInput, { flex: 1, marginBottom: 0 }]}
                      value={opt}
                      onChangeText={(v) => {
                        const next = [...ballotForm.options];
                        next[idx] = v;
                        setBallotForm({ ...ballotForm, options: next });
                      }}
                      placeholder={idx === 0 ? "e.g. Approve" : idx === 1 ? "e.g. Reject" : "e.g. Defer to Next Quarter"}
                      placeholderTextColor={Colors.slate}
                    />
                  </View>
                ))}
                {ballotForm.options.length < 4 && (
                  <TouchableOpacity
                    style={styles.addOptionBtn}
                    onPress={() => setBallotForm({ ...ballotForm, options: [...ballotForm.options, ""] })}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#7C3AED" />
                    <Text style={styles.addOptionBtnText}>Add Option</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.noticeFooter}>
                <Text style={styles.noticeFooterText}>
                  This ballot will be published immediately and appear in the Voting tab for all community members. Results are visible in real-time as members cast votes.
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── SEND NOTICE MODAL ── */}
      <Modal visible={noticeModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setNoticeModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setNoticeModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="mail" size={16} color={Colors.warning} />
                <Text style={styles.modalTitle}>Send Notice</Text>
              </View>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: Colors.warning }, noticeSending && { opacity: 0.6 }]}
                onPress={sendNotice}
                disabled={noticeSending}
              >
                {noticeSending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSaveBtnText}>Send</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>RECIPIENTS</Text>
                <View style={styles.toggleRow}>
                  {([["all", "All Residents"], ["owners", "Owners Only"], ["tenants", "Tenants Only"]] as const).map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.toggleBtn, noticeForm.recipients === key && styles.toggleActive]}
                      onPress={() => setNoticeForm({ ...noticeForm, recipients: key })}
                    >
                      <Text style={[styles.toggleText, noticeForm.recipients === key && styles.toggleTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>NOTICE CATEGORY</Text>
                <View style={styles.categoryGrid}>
                  {([
                    { key: "general" as const,     label: "General",     icon: "information-circle", color: Colors.navy },
                    { key: "maintenance" as const, label: "Maintenance",  icon: "construct",          color: Colors.warning },
                    { key: "urgent" as const,      label: "Urgent",       icon: "alert-circle",       color: Colors.danger },
                    { key: "legal" as const,       label: "Legal",        icon: "briefcase",          color: "#7C3AED" },
                  ]).map((cat) => {
                    const active = noticeForm.category === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[styles.categoryChip, active && { backgroundColor: cat.color + "15", borderColor: cat.color }]}
                        onPress={() => setNoticeForm({ ...noticeForm, category: cat.key })}
                      >
                        <Ionicons name={cat.icon as any} size={14} color={active ? cat.color : Colors.textSecondary} />
                        <Text style={[styles.categoryChipText, active && { color: cat.color, fontFamily: "Inter_600SemiBold" }]}>{cat.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>MESSAGE</Text>
                <VField label="Subject *" value={noticeForm.subject} onChangeText={(v) => setNoticeForm({ ...noticeForm, subject: v })} placeholder="e.g. Pool Closure — Friday July 4th" />
                <VField label="Message Body *" value={noticeForm.body} onChangeText={(v) => setNoticeForm({ ...noticeForm, body: v })} placeholder="Write your notice message here. Be clear and concise — include any dates, times, or actions residents need to take..." multiline />
              </View>

              <View style={styles.noticeFooter}>
                <Text style={styles.noticeFooterText}>
                  This notice will be sent to {noticeForm.recipients === "all" ? "all residents" : noticeForm.recipients === "owners" ? "unit owners" : "tenants"} and posted on the community home screen. Urgent notices are automatically pinned to the top.
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── WORK ORDERS LIST MODAL ── */}
      <Modal visible={woListModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setWoListModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setWoListModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.modalTitleWrap}>
              <Ionicons name="construct" size={16} color="#0891B2" />
              <Text style={styles.modalTitle}>Work Orders</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#0891B218" }]}>
              <Text style={[styles.badgeText, { color: "#0891B2" }]}>
                {workOrders.filter((w) => w.status === "submitted").length} new
              </Text>
            </View>
          </View>

          {/* Filter tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.woFilterScroll} contentContainerStyle={styles.woFilterContent}>
            {([
              { key: "all",         label: "All",         color: Colors.text },
              { key: "submitted",   label: "New",         color: "#3B82F6" },
              { key: "in-progress", label: "In Progress", color: Colors.warning },
              { key: "completed",   label: "Completed",   color: Colors.success },
              { key: "cancelled",   label: "Cancelled",   color: Colors.slate },
            ] as const).map((f) => {
              const count = f.key === "all" ? workOrders.length : workOrders.filter((w) => w.status === f.key).length;
              const active = woListFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.woFilterTab, active && { backgroundColor: "#0891B2", borderColor: "#0891B2" }]}
                  onPress={() => { Haptics.selectionAsync(); setWoListFilter(f.key); }}
                >
                  <Text style={[styles.woFilterText, active && { color: "#fff" }]}>{f.label}</Text>
                  <View style={[styles.woFilterBadge, active && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                    <Text style={[styles.woFilterBadgeText, active && { color: "#fff" }]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {workOrders
              .filter((w) => woListFilter === "all" || w.status === woListFilter)
              .length === 0 ? (
              <View style={styles.emptyViolations}>
                <Ionicons name="construct-outline" size={36} color={Colors.border} />
                <Text style={styles.emptyViolationsText}>No work orders in this category</Text>
              </View>
            ) : (
              workOrders
                .filter((w) => woListFilter === "all" || w.status === woListFilter)
                .map((wo) => {
                  const priorityColors: Record<string, string> = {
                    low: Colors.success, medium: Colors.warning, high: Colors.danger, emergency: "#7C0000",
                  };
                  const woStatusConf: Record<string, { color: string; bg: string; label: string }> = {
                    submitted:    { color: "#3B82F6", bg: "#EFF6FF", label: "New" },
                    "in-progress": { color: Colors.warning, bg: Colors.warning + "15", label: "In Progress" },
                    completed:    { color: Colors.success, bg: Colors.success + "18", label: "Completed" },
                    cancelled:    { color: Colors.slate, bg: Colors.slate + "18", label: "Cancelled" },
                  };
                  const sc = woStatusConf[wo.status] ?? woStatusConf.submitted;
                  const pc = priorityColors[wo.priority] ?? Colors.slate;
                  return (
                    <TouchableOpacity
                      key={wo.id}
                      style={styles.violationCard}
                      onPress={() => { setWoListModal(false); setBoardNotesDraft(wo.board_notes ?? ""); setDetailWorkOrder(wo); }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.violationTypeDot, { backgroundColor: pc }]} />
                      <View style={styles.violationBody}>
                        <View style={styles.violationTop}>
                          <Text style={styles.violationName} numberOfLines={1}>{wo.title}</Text>
                          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                            <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
                          </View>
                        </View>
                        <Text style={styles.violationType}>{wo.resident_name} · Unit {wo.unit} · {wo.category}</Text>
                        <Text style={styles.violationDate}>
                          {new Date(wo.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {wo.priority === "high" || wo.priority === "emergency" ? " · ⚠️ " + wo.priority : ""}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                    </TouchableOpacity>
                  );
                })
            )}
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}

function VField({ label, value, onChangeText, placeholder, multiline, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  multiline?: boolean; keyboardType?: any;
}) {
  return (
    <View style={styles.vFieldWrap}>
      <Text style={styles.vLabel}>{label}</Text>
      <TextInput
        style={[styles.vInput, multiline && styles.vInputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.slate}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
      />
    </View>
  );
}

function NoticeRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.noticeRow}>
      <Text style={styles.noticeRowLabel}>{label}</Text>
      <Text style={[styles.noticeRowValue, highlight && styles.noticeRowHighlight]}>{value}</Text>
    </View>
  );
}

function ReportStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.reportStat}>
      <Text style={[styles.reportStatValue, color ? { color } : {}]}>{String(value)}</Text>
      <Text style={styles.reportStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.background, alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },

  heroCard: { margin: 16, backgroundColor: Colors.navy, borderRadius: 18, padding: 20 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  heroLabel: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: Colors.gold, letterSpacing: 1.5, marginBottom: 4 },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  heroBadge: { backgroundColor: "rgba(201,168,76,0.2)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: "rgba(201,168,76,0.3)" },
  heroBadgeText: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.gold },
  heroStats: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff" },
  heroStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.slate, marginTop: 2 },
  heroStatDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 4 },

  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  toolsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  toolCard: {
    width: "30.5%", backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    alignItems: "center", gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  toolIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  toolLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.text, textAlign: "center", lineHeight: 14 },

  violationCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.card,
    borderRadius: 12, padding: 14, marginBottom: 8, gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  violationTypeDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0, marginTop: 4, alignSelf: "flex-start" },
  violationBody: { flex: 1, gap: 3 },
  violationTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  violationName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text, flex: 1 },
  violationType: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  violationMeta: { flexDirection: "row", gap: 12, marginTop: 2 },
  violationDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.slate },
  violationFine: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.danger },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusPillText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  emptyViolations: { alignItems: "center", padding: 24, gap: 8 },
  emptyViolationsText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.slate },
  logViolationBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: Colors.danger + "10", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.danger + "30", marginTop: 4, marginBottom: 8,
  },
  logViolationBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.danger },

  actionItem: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.card,
    borderRadius: 12, padding: 14, marginBottom: 8, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  actionItemDone: { opacity: 0.5 },
  checkBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  checkBoxDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  actionItemContent: { flex: 1 },
  actionItemTitle: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  actionItemTitleDone: { textDecorationLine: "line-through", color: Colors.slate },
  actionItemCategory: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  priorityDot: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  priorityText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },

  memberCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.navy, alignItems: "center", justifyContent: "center" },
  memberInitials: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.gold },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  memberRole: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  memberSince: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.slate },

  meetingCard: { backgroundColor: Colors.card, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "rgba(201,168,76,0.25)", marginBottom: 16 },
  meetingIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(201,168,76,0.1)", alignItems: "center", justifyContent: "center" },
  meetingLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  meetingDate: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.text },
  meetingLocation: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  meetingBtn: { backgroundColor: Colors.gold, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  meetingBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.navy },

  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: "#fff",
  },
  modalCloseBtn: { padding: 4 },
  modalTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  modalSaveBtn: { backgroundColor: Colors.danger, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, minWidth: 52, alignItems: "center" },
  modalSaveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },

  deleteWoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 24, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.danger + "55", backgroundColor: Colors.danger + "10" },
  deleteWoBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.danger },
  deleteConfirmBox: { marginTop: 24, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.danger, backgroundColor: Colors.danger + "0C", padding: 16, gap: 10, alignItems: "center" },
  deleteConfirmText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text, textAlign: "center" },
  deleteConfirmBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  deleteConfirmCancel: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center", backgroundColor: "#fff" },
  deleteConfirmCancelText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  deleteConfirmYes: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.danger, alignItems: "center" },
  deleteConfirmYesText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card },
  categoryChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  pinnedRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  pinnedLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  pinnedSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  reportBanner: { backgroundColor: Colors.navy, borderRadius: 12, padding: 16, marginBottom: 20, alignItems: "center" },
  reportBannerTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  reportBannerDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 },
  reportSection: { marginBottom: 20, backgroundColor: Colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  reportSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  reportSectionTitle: { fontFamily: "Inter_700Bold", fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.8 },
  reportRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  reportStat: { flex: 1, alignItems: "center", backgroundColor: Colors.background, borderRadius: 8, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  reportStatValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.navy },
  reportStatLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: "center" },
  reportBars: { marginTop: 14, gap: 8 },
  reportBarsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.5, marginBottom: 4 },
  reportBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  reportBarLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.text, width: 90 },
  reportBarTrack: { flex: 1, height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: "hidden" },
  reportBarFill: { height: 8, borderRadius: 4, minWidth: 4 },
  reportBarValue: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.text, width: 24, textAlign: "right" },

  formScroll: { padding: 16, gap: 0, paddingBottom: 40 },
  detailScroll: { padding: 16, gap: 0, paddingBottom: 40 },

  noticeBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "rgba(201,168,76,0.08)", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "rgba(201,168,76,0.2)", marginBottom: 20,
  },
  noticeBannerTitle: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.navy },
  noticeBannerSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  formSection: { marginBottom: 20 },
  formSectionTitle: {
    fontFamily: "Inter_700Bold", fontSize: 10, color: Colors.slate,
    letterSpacing: 1.2, marginBottom: 12, textTransform: "uppercase",
  },

  vFieldWrap: { marginBottom: 12 },
  vLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  vInput: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 11, fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text,
  },
  vInputMulti: { minHeight: 90, textAlignVertical: "top" },

  typeSelector: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 13, marginBottom: 4,
  },
  typeSelectorText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text },
  typePicker: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 12, overflow: "hidden",
  },
  typeOption: { paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: Colors.border },
  typeOptionActive: { backgroundColor: "rgba(201,168,76,0.06)" },
  typeOptionText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text },
  typeOptionTextActive: { fontFamily: "Inter_600SemiBold", color: Colors.navy },

  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#fff", alignItems: "center" },
  toggleActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  toggleText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  toggleTextActive: { color: "#fff" },

  detailCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", marginBottom: 16 },
  noticeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  noticeRowLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.slate, flex: 1 },
  noticeRowValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text, flex: 2, textAlign: "right" },
  noticeRowHighlight: { color: Colors.danger },

  noticeSection: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 12 },
  noticeSectionLabel: { fontFamily: "Inter_700Bold", fontSize: 10, color: Colors.slate, letterSpacing: 1.2, marginBottom: 8 },
  noticeSectionText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text, lineHeight: 22 },

  statusRow: { flexDirection: "row", gap: 10 },
  statusBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#fff", alignItems: "center" },
  statusBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textSecondary },

  noticeFooter: { backgroundColor: Colors.background, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: Colors.border, marginTop: 8 },
  noticeFooterText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.slate, lineHeight: 17, textAlign: "center" },

  voterRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 },
  voterBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  voterCount: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, minWidth: 40, textAlign: "center" },

  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  optionNum: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#7C3AED18", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optionNumText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#7C3AED" },
  addOptionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, justifyContent: "center" },
  addOptionBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#7C3AED" },

  woFilterScroll: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  woFilterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row" },
  woFilterTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  woFilterText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textSecondary },
  woFilterBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  woFilterBadgeText: { fontFamily: "Inter_700Bold", fontSize: 11, color: Colors.textSecondary },
});
