import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  pinned: boolean;
  category: "general" | "maintenance" | "event" | "urgent";
}

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
}

const SEED_ANNOUNCEMENTS: Announcement[] = [
{ id: "2", title: "Spring Community Cleanup Day", body: "Join your neighbors on March 15 at 9 AM for our annual spring cleanup. Refreshments provided!", date: "2026-02-28", pinned: false, category: "event" },
  { id: "3", title: "Q1 Board Meeting – March 20", body: "The quarterly board meeting will be held in the community center at 7 PM. All residents welcome.", date: "2026-02-25", pinned: false, category: "general" },
  { id: "4", title: "Updated Parking Policy", body: "Effective April 1, all guest vehicles must display a visitor pass. Passes available at the management office.", date: "2026-02-20", pinned: false, category: "general" },
];

const STORAGE_KEY = "hoa_announcements";
const PROFILE_KEY = "resident_profile";

const categoryConfig = {
  general: { color: Colors.navy, icon: "megaphone-outline" as const },
  maintenance: { color: Colors.warning, icon: "construct" as const },
  event: { color: Colors.success, icon: "calendar" as const },
  urgent: { color: Colors.danger, icon: "alert-circle" as const },
};

const WO_CATEGORIES = ["Plumbing", "Electrical", "HVAC", "Appliance", "Landscaping", "Common Area", "Structural", "Other"];
const WO_PRIORITIES = ["low", "medium", "high", "emergency"] as const;
const PRIORITY_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High", emergency: "Emergency" };

const woStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  submitted:   { color: "#3B82F6", bg: "#EFF6FF", label: "Submitted" },
  "in-progress": { color: Colors.warning, bg: Colors.warning + "15", label: "In Progress" },
  completed:   { color: Colors.success, bg: Colors.success + "18", label: "Completed" },
  cancelled:   { color: Colors.slate, bg: Colors.slate + "18", label: "Cancelled" },
};

const EMPTY_FORM = { title: "", category: "Plumbing", priority: "medium" as typeof WO_PRIORITIES[number], description: "", resident_name: "", unit: "" };

function apiRequest(method: string, path: string, body?: object) {
  const url = new URL(path, getApiUrl()).toString();
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
}

function AnnouncementCard({ item }: { item: Announcement }) {
  const config = categoryConfig[item.category];
  const dateStr = new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <View style={[styles.announcementCard, item.pinned && styles.pinnedCard]}>
      {item.pinned && (
        <View style={styles.pinnedBadge}>
          <Ionicons name="pin" size={10} color={Colors.gold} />
          <Text style={styles.pinnedText}>PINNED</Text>
        </View>
      )}
      <View style={styles.announcementHeader}>
        <View style={[styles.categoryDot, { backgroundColor: config.color }]}>
          <Ionicons name={config.icon} size={12} color="#fff" />
        </View>
        <Text style={styles.announcementDate}>{dateStr}</Text>
      </View>
      <Text style={styles.announcementTitle}>{item.title}</Text>
      <Text style={styles.announcementBody} numberOfLines={2}>{item.body}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { resident, logout } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [duesStatus, setDuesStatus] = useState({ paid: false, amount: 155, dueDate: "2026-03-31" });
  const [activeVotes, setActiveVotes] = useState(0);
  const [woModal, setWoModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [savedUnit, setSavedUnit] = useState(resident?.unit || "");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const loadData = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) { setAnnouncements(JSON.parse(stored)); }
      else { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ANNOUNCEMENTS)); setAnnouncements(SEED_ANNOUNCEMENTS); }

      const duesData = await AsyncStorage.getItem("hoa_dues");
      if (duesData) {
        const dues = JSON.parse(duesData);
        const cur = dues.find((d: any) => d.period === "Q1 2026");
        if (cur) setDuesStatus({ paid: cur.paid, amount: cur.amount, dueDate: cur.dueDate });
      }

      const votesData = await AsyncStorage.getItem("hoa_votes");
      if (votesData) {
        const votes = JSON.parse(votesData);
        setActiveVotes(votes.filter((v: any) => v.status === "active").length);
      } else { setActiveVotes(2); }

      const profile = await AsyncStorage.getItem(PROFILE_KEY);
      if (profile) {
        const p = JSON.parse(profile);
        setSavedUnit(p.unit || "");
      }
    } catch { setAnnouncements(SEED_ANNOUNCEMENTS); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const { data: myWorkOrders = [] } = useQuery<WorkOrder[]>({
    queryKey: ["/api/work-orders", savedUnit],
    enabled: !!savedUnit,
    queryFn: () => {
      const url = new URL(`/api/work-orders?unit=${encodeURIComponent(savedUnit)}`, getApiUrl()).toString();
      return fetch(url).then((r) => r.json());
    },
  });

  const createWorkOrder = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => apiRequest("POST", "/api/work-orders", data),
    onSuccess: async (result) => {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ name: form.resident_name, unit: form.unit }));
      setSavedUnit(form.unit);
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setWoModal(false);
      setForm({ ...EMPTY_FORM });
      Alert.alert("Work Order Submitted", `Your work order #${result.id} has been submitted and will be reviewed by the board.`);
    },
    onError: () => Alert.alert("Error", "Failed to submit work order. Please try again."),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    await queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    setRefreshing(false);
  }, [loadData, queryClient]);

  const handleBoardPress = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/board"); };

  const openWorkOrderModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (resident) {
      setForm({ ...EMPTY_FORM, resident_name: resident.name, unit: resident.unit });
    } else {
      AsyncStorage.getItem(PROFILE_KEY).then((p) => {
        if (p) {
          const profile = JSON.parse(p);
          setForm({ ...EMPTY_FORM, resident_name: profile.name || "", unit: profile.unit || "" });
        } else {
          setForm({ ...EMPTY_FORM });
        }
      });
    }
    setWoModal(true);
  };

  const handleSubmitWorkOrder = () => {
    if (!form.title.trim() || !form.resident_name.trim() || !form.unit.trim() || !form.description.trim()) {
      Alert.alert("Required Fields", "Please fill in title, name, unit, and description.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createWorkOrder.mutate(form);
  };
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.appNameRow}>
            <MaterialCommunityIcons name="home-city" size={22} color="#fff" />
            <Text style={styles.appName}>Beyond HOA</Text>
          </View>
          <Text style={styles.dashboardTitle}>
            {resident ? `Hi, ${resident.name.split(" ")[0]}  ·  Unit ${resident.unit}` : "Resident Dashboard"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.boardButton} onPress={handleBoardPress} activeOpacity={0.8}>
            <MaterialCommunityIcons name="shield-star" size={18} color="#fff" />
            <Text style={styles.boardButtonText}>Board</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setConfirmLogout(true)} activeOpacity={0.7} style={styles.logoutBtn} testID="logout-btn">
            <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.75)" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: duesStatus.paid ? Colors.success : Colors.danger }]}>
            <View style={styles.statIconWrap}>
              <Ionicons name={duesStatus.paid ? "checkmark-circle" : "alert-circle"} size={22} color={duesStatus.paid ? Colors.success : Colors.danger} />
            </View>
            <Text style={styles.statLabel}>Q1 Dues</Text>
            <Text style={styles.statValue}>${duesStatus.amount}</Text>
            <Text style={[styles.statSub, { color: duesStatus.paid ? Colors.success : Colors.danger }]}>
              {duesStatus.paid ? "Paid" : `Due ${new Date(duesStatus.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </Text>
          </View>

          <View style={[styles.statCard, { borderLeftColor: activeVotes > 0 ? Colors.gold : Colors.slate }]}>
            <View style={styles.statIconWrap}>
              <Ionicons name="checkmark-circle" size={22} color={activeVotes > 0 ? Colors.gold : Colors.slate} />
            </View>
            <Text style={styles.statLabel}>Active Votes</Text>
            <Text style={styles.statValue}>{activeVotes}</Text>
            <Text style={[styles.statSub, { color: activeVotes > 0 ? Colors.gold : Colors.slate }]}>
              {activeVotes > 0 ? "Needs attention" : "All caught up"}
            </Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/voting"); }} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.navy} />
            <Text style={styles.actionLabel}>Vote</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/dues"); }} activeOpacity={0.8}>
            <Ionicons name="card" size={20} color={Colors.navy} />
            <Text style={styles.actionLabel}>Pay Dues</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/documents"); }} activeOpacity={0.8}>
            <Ionicons name="document-text" size={20} color={Colors.navy} />
            <Text style={styles.actionLabel}>Docs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/assistant"); }} activeOpacity={0.8}>
            <Ionicons name="chatbubbles" size={20} color={Colors.navy} />
            <Text style={styles.actionLabel}>AI Help</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Work Orders</Text>
            {myWorkOrders.filter((w) => w.status === "submitted" || w.status === "in-progress").length > 0 && (
              <View style={styles.woBadge}>
                <Text style={styles.woBadgeText}>
                  {myWorkOrders.filter((w) => w.status === "submitted" || w.status === "in-progress").length} active
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.submitWoBtn} onPress={openWorkOrderModal} activeOpacity={0.8} testID="submit-wo-btn">
            <View style={styles.submitWoBtnIcon}>
              <Ionicons name="construct" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.submitWoBtnTitle}>Submit a Work Order</Text>
              <Text style={styles.submitWoBtnSub}>Report maintenance issues to the board</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.gold} />
          </TouchableOpacity>

          {myWorkOrders.length > 0 && (
            <View style={styles.myOrdersList}>
              {myWorkOrders.slice(0, 3).map((wo) => {
                const sc = woStatusConfig[wo.status] ?? woStatusConfig.submitted;
                return (
                  <View key={wo.id} style={styles.woCard}>
                    <View style={styles.woCardLeft}>
                      <Text style={styles.woTitle} numberOfLines={1}>{wo.title}</Text>
                      <View style={styles.woMeta}>
                        <Text style={styles.woCat}>{wo.category}</Text>
                        <Text style={styles.woDot}>·</Text>
                        <Text style={styles.woDate}>
                          {new Date(wo.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.woStatusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.woStatusText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {savedUnit && myWorkOrders.length === 0 && (
            <Text style={styles.noOrdersText}>No work orders submitted yet</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community Announcements</Text>
          {sortedAnnouncements.map((item) => <AnnouncementCard key={item.id} item={item} />)}
          {sortedAnnouncements.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="megaphone-outline" size={40} color={Colors.slate} />
              <Text style={styles.emptyText}>No announcements yet</Text>
            </View>
          )}
        </View>

        <View style={styles.signOutSection}>
          <View style={styles.signOutInfo}>
            <View style={styles.signOutAvatar}>
              <Ionicons name="person" size={18} color={Colors.navy} />
            </View>
            <View>
              <Text style={styles.signOutName}>{resident?.name ?? "Resident"}</Text>
              <Text style={styles.signOutUnit}>Unit {resident?.unit ?? "—"}</Text>
            </View>
          </View>
          {confirmLogout ? (
            <View style={styles.signOutConfirm}>
              <Text style={styles.signOutConfirmText}>Sign out?</Text>
              <TouchableOpacity onPress={handleLogout} style={styles.signOutConfirmYes} testID="confirm-signout-btn">
                <Text style={styles.signOutConfirmYesText}>Yes, sign out</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setConfirmLogout(false)} style={styles.signOutConfirmNo}>
                <Text style={styles.signOutConfirmNoText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setConfirmLogout(true)} style={styles.signOutBtn} activeOpacity={0.8} testID="signout-section-btn">
              <Ionicons name="log-out-outline" size={16} color={Colors.danger} />
              <Text style={styles.signOutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: Platform.OS === "web" ? 120 : 100 }} />
      </ScrollView>

      <Modal visible={woModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setWoModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setWoModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
              <View style={styles.modalTitleRow}>
                <Ionicons name="construct" size={16} color="#0891B2" />
                <Text style={styles.modalTitle}>Submit Work Order</Text>
              </View>
              <TouchableOpacity onPress={handleSubmitWorkOrder} style={styles.modalSubmitBtn} disabled={createWorkOrder.isPending}>
                {createWorkOrder.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalSubmitText}>Submit</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.formSection}>
                <Text style={styles.formSectionLabel}>YOUR INFORMATION</Text>
                <WoField label="Full Name *" value={form.resident_name} onChangeText={(v) => setForm({ ...form, resident_name: v })} placeholder="Your full name" />
                <WoField label="Unit Number *" value={form.unit} onChangeText={(v) => setForm({ ...form, unit: v })} placeholder="e.g. 102" keyboardType="default" />
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionLabel}>ISSUE DETAILS</Text>
                <WoField label="Title *" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Brief description of the issue" />

                <Text style={styles.fieldLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {WO_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, form.category === cat && styles.chipActive]}
                      onPress={() => { setForm({ ...form, category: cat }); Haptics.selectionAsync(); }}
                    >
                      <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Priority</Text>
                <View style={styles.priorityRow}>
                  {WO_PRIORITIES.map((p) => {
                    const colors: Record<string, string> = { low: Colors.success, medium: Colors.warning, high: Colors.danger, emergency: "#7C0000" };
                    const isActive = form.priority === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.priorityBtn, isActive && { backgroundColor: colors[p] + "18", borderColor: colors[p] }]}
                        onPress={() => { setForm({ ...form, priority: p }); Haptics.selectionAsync(); }}
                      >
                        <Text style={[styles.priorityBtnText, isActive && { color: colors[p] }]}>{PRIORITY_LABELS[p]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <WoField label="Description *" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Please describe the issue in detail, including location and how long it has been occurring..." multiline />
              </View>

              <View style={styles.disclaimer}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.slate} />
                <Text style={styles.disclaimerText}>
                  Your work order will be reviewed by the board and you will be notified of any updates. Emergency issues should also be reported by phone.
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function WoField({ label, value, onChangeText, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  keyboardType?: any; multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={Colors.slate}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline} numberOfLines={multiline ? 4 : 1}
        autoCapitalize="sentences"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, backgroundColor: Colors.navy,
  },
  appNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  appName: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff", letterSpacing: 0.2 },
  dashboardTitle: { fontFamily: "Inter_400Regular", fontSize: 16, color: "rgba(255,255,255,0.75)" },
  boardButton: {
    flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  boardButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoutBtn: { padding: 6, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)" },

  statsRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  statCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 16, borderLeftWidth: 3,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statIconWrap: { marginBottom: 8 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.text, marginTop: 4 },
  statSub: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 4 },

  quickActions: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  actionBtn: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 12, paddingVertical: 14,
    alignItems: "center", gap: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  actionLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.text },

  section: { paddingHorizontal: 16, paddingTop: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text, marginBottom: 12 },
  woBadge: { backgroundColor: "#0891B2" + "18", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  woBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#0891B2" },

  submitWoBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#0891B2" + "30",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    marginBottom: 10,
  },
  submitWoBtnIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "#0891B2", alignItems: "center", justifyContent: "center",
  },
  submitWoBtnTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  submitWoBtnSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  myOrdersList: { gap: 8, marginTop: 4 },
  woCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.card,
    borderRadius: 12, padding: 14, gap: 12, borderWidth: 1, borderColor: Colors.border,
  },
  woCardLeft: { flex: 1 },
  woTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  woMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  woCat: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  woDot: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.slate },
  woDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.slate },
  woStatusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  woStatusText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  noOrdersText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.slate, textAlign: "center", paddingVertical: 12 },

  announcementCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  pinnedCard: { borderWidth: 1, borderColor: "rgba(201,168,76,0.3)", backgroundColor: "rgba(201,168,76,0.04)" },
  pinnedBadge: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 8 },
  pinnedText: { fontFamily: "Inter_700Bold", fontSize: 9, color: Colors.gold, letterSpacing: 1 },
  announcementHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  categoryDot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  announcementDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  announcementTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text, marginBottom: 4 },
  announcementBody: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.slate },

  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: "#fff",
  },
  modalCloseBtn: { padding: 4 },
  modalTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  modalSubmitBtn: { backgroundColor: "#0891B2", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, minWidth: 64, alignItems: "center" },
  modalSubmitText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },

  modalScroll: { padding: 16, paddingBottom: 40 },
  formSection: { marginBottom: 20 },
  formSectionLabel: { fontFamily: "Inter_700Bold", fontSize: 10, color: Colors.white, letterSpacing: 1.2, marginBottom: 12, textTransform: "uppercase" },

  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 11, fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text,
  },
  fieldInputMulti: { minHeight: 100, textAlignVertical: "top" },

  chipRow: { flexDirection: "row", gap: 8, paddingBottom: 12, paddingTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },

  priorityRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  priorityBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#fff", alignItems: "center" },
  priorityBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.textSecondary },

  disclaimer: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: Colors.card, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, marginTop: 4 },
  disclaimerText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.slate, lineHeight: 18, flex: 1 },

  signOutSection: {
    marginHorizontal: 16, marginTop: 16, backgroundColor: Colors.card,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 12, gap: 12,
  },
  signOutInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  signOutAvatar: {
    width: 40, height: 40, borderRadius: 19,
    borderRadius: Colors.navy + "15", alignItems: "center", justifyContent: "center",
  },
  signOutName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  signOutUnit: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  signOutBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 16, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.danger + "30",
    backgroundColor: Colors.danger + "08", alignSelf: "flex-start",
  },
  signOutBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.danger },
  signOutConfirm: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  signOutConfirmText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  signOutConfirmYes: {
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: Colors.danger,
  },
  signOutConfirmYesText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  signOutConfirmNo: {
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  signOutConfirmNoText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
});
