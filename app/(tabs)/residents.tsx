import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Colors } from "@/constants/colors";
import { getApiUrl } from "@/lib/query-client";

interface Resident {
  id: number;
  name: string;
  unit: string;
  email: string | null;
  phone: string | null;
  status: "owner" | "tenant";
  move_in_date: string | null;
  notes: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  name: "",
  unit: "",
  email: "",
  phone: "",
  status: "owner" as "owner" | "tenant",
  move_in_date: "",
  notes: "",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

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

export default function ResidentsScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "owner" | "tenant">("all");
  const [modalVisible, setModalVisible] = useState(false);
  const [detailResident, setDetailResident] = useState<Resident | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [refreshing, setRefreshing] = useState(false);

  const { data: residents = [], isLoading } = useQuery<Resident[]>({
    queryKey: ["/api/residents"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      apiRequest("POST", "/api/residents", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/residents"] });
      closeModal();
    },
    onError: () => Alert.alert("Error", "Failed to save resident."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof EMPTY_FORM }) =>
      apiRequest("PUT", `/api/residents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/residents"] });
      closeModal();
    },
    onError: () => Alert.alert("Error", "Failed to update resident."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/residents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/residents"] });
      setDetailResident(null);
    },
    onError: () => Alert.alert("Error", "Failed to delete resident."),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/residents"] });
    setRefreshing(false);
  }, [queryClient]);

  const filtered = useMemo(() => {
    let list = residents;
    if (filterStatus !== "all") list = list.filter((r) => r.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.unit.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.phone?.includes(q)
      );
    }
    return list;
  }, [residents, search, filterStatus]);

  const ownerCount = residents.filter((r) => r.status === "owner").length;
  const tenantCount = residents.filter((r) => r.status === "tenant").length;

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setEditMode(false);
    setDetailResident(null);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function openEdit(r: Resident) {
    setForm({
      name: r.name,
      unit: r.unit,
      email: r.email ?? "",
      phone: r.phone ?? "",
      status: r.status,
      move_in_date: r.move_in_date ?? "",
      notes: r.notes ?? "",
    });
    setEditMode(true);
    setDetailResident(r);
    setModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function closeModal() {
    setModalVisible(false);
    setEditMode(false);
  }

  function handleSave() {
    if (!form.name.trim() || !form.unit.trim()) {
      Alert.alert("Required", "Name and unit are required.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (editMode && detailResident) {
      updateMutation.mutate({ id: detailResident.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function handleDelete(r: Resident) {
    Alert.alert(
      "Remove Resident",
      `Remove ${r.name} from the directory?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            deleteMutation.mutate(r.id);
          },
        },
      ]
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const renderResident = ({ item }: { item: Resident }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setDetailResident(item)}
      activeOpacity={0.75}
      testID={`resident-${item.id}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.residentName} numberOfLines={1}>{item.name}</Text>
          <View style={[styles.statusBadge, item.status === "owner" ? styles.ownerBadge : styles.tenantBadge]}>
            <Text style={[styles.statusText, item.status === "owner" ? styles.ownerText : styles.tenantText]}>
              {item.status === "owner" ? "Owner" : "Tenant"}
            </Text>
          </View>
        </View>
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="business-outline" size={11} color={Colors.navy} />
            <Text style={styles.metaText}>Unit {item.unit}</Text>
          </View>
          {item.email && (
            <View style={styles.metaItem}>
              <Ionicons name="mail-outline" size={11} color={Colors.navy} />
              <Text style={styles.metaText} numberOfLines={1}>{item.email}</Text>
            </View>
          )}
          {item.phone && (
            <View style={styles.metaItem}>
              <Ionicons name="call-outline" size={11} color={Colors.navy} />
              <Text style={styles.metaText}>{item.phone}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.border} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <View>
          <View style={styles.appNameRow}>
            <MaterialCommunityIcons name="account-group" size={14} color="#fff" />
            <Text style={styles.appName}>Beyond HOA</Text>
          </View>
          <Text style={styles.headerTitle}>Residents</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAdd} activeOpacity={0.8} testID="add-resident-btn">
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color={Colors.navy} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, unit, or contact..."
          placeholderTextColor={Colors.slate}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          testID="residents-search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={Colors.slate} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity
          style={[styles.statChip, filterStatus === "all" && styles.statChipActive]}
          onPress={() => { setFilterStatus("all"); Haptics.selectionAsync(); }}
        >
          <Text style={[styles.statChipText, filterStatus === "all" && styles.statChipTextActive]}>
            All {residents.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statChip, filterStatus === "owner" && styles.statChipOwner]}
          onPress={() => { setFilterStatus("owner"); Haptics.selectionAsync(); }}
        >
          <View style={styles.statChipDot} />
          <Text style={[styles.statChipText, filterStatus === "owner" && styles.statChipTextActive]}>
            Owners {ownerCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statChip, filterStatus === "tenant" && styles.statChipTenant]}
          onPress={() => { setFilterStatus("tenant"); Haptics.selectionAsync(); }}
        >
          <View style={[styles.statChipDot, styles.tenantDot]} />
          <Text style={[styles.statChipText, filterStatus === "tenant" && styles.statChipTextActive]}>
            Tenants {tenantCount}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={Colors.gold} size="large" />
          <Text style={styles.loadingText}>Loading residents…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderResident}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="account-off-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>No residents found</Text>
              <Text style={styles.emptySubText}>
                {search ? "Try a different search term" : "Tap + to add a resident"}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={!!detailResident && !modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailResident(null)}
      >
        {detailResident && (
          <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setDetailResident(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.detailHeaderTitle}>Resident Details</Text>
              <TouchableOpacity onPress={() => openEdit(detailResident)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.detailContent}>
              <View style={styles.detailAvatarWrap}>
                <View style={styles.detailAvatar}>
                  <Text style={styles.detailAvatarText}>{getInitials(detailResident.name)}</Text>
                </View>
                <Text style={styles.detailName}>{detailResident.name}</Text>
                <View style={[styles.statusBadge, styles.detailBadge, detailResident.status === "owner" ? styles.ownerBadge : styles.tenantBadge]}>
                  <Text style={[styles.statusText, detailResident.status === "owner" ? styles.ownerText : styles.tenantText]}>
                    {detailResident.status === "owner" ? "Owner" : "Tenant"}
                  </Text>
                </View>
              </View>

              <View style={styles.detailCard}>
                <DetailRow icon="business-outline" label="Unit" value={`Unit ${detailResident.unit}`} />
                {detailResident.email && <DetailRow icon="mail-outline" label="Email" value={detailResident.email} />}
                {detailResident.phone && <DetailRow icon="call-outline" label="Phone" value={detailResident.phone} />}
                {detailResident.move_in_date && (
                  <DetailRow
                    icon="calendar-outline"
                    label="Move-in"
                    value={new Date(detailResident.move_in_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  />
                )}
                {detailResident.notes && <DetailRow icon="document-text-outline" label="Notes" value={detailResident.notes} />}
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(detailResident)}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                <Text style={styles.deleteButtonText}>Remove Resident</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </Modal>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.detailHeaderTitle}>{editMode ? "Edit Resident" : "Add Resident"}</Text>
              <TouchableOpacity onPress={handleSave} style={styles.editBtn} disabled={isSaving} testID="save-resident-btn">
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.navy} />
                ) : (
                  <Text style={styles.editBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <FormField label="Full Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="e.g. Jane Smith" testID="field-name" />
              <FormField label="Unit Number *" value={form.unit} onChangeText={(v) => setForm({ ...form, unit: v })} placeholder="e.g. 101" testID="field-unit" />

              <Text style={styles.fieldLabel}>Status *</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, form.status === "owner" && styles.toggleActive]}
                  onPress={() => setForm({ ...form, status: "owner" })}
                >
                  <Text style={[styles.toggleText, form.status === "owner" && styles.toggleTextActive]}>Owner</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, form.status === "tenant" && styles.toggleActive]}
                  onPress={() => setForm({ ...form, status: "tenant" })}
                >
                  <Text style={[styles.toggleText, form.status === "tenant" && styles.toggleTextActive]}>Tenant</Text>
                </TouchableOpacity>
              </View>

              <FormField label="Email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} placeholder="email@example.com" keyboardType="email-address" testID="field-email" />
              <FormField label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} placeholder="(555) 000-0000" keyboardType="phone-pad" testID="field-phone" />
              <FormField label="Move-in Date" value={form.move_in_date} onChangeText={(v) => setForm({ ...form, move_in_date: v })} placeholder="YYYY-MM-DD" testID="field-date" />
              <FormField label="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder="Optional notes..." multiline testID="field-notes" />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={16} color={Colors.gold} style={styles.detailRowIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value}</Text>
      </View>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  multiline?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.slate}
        keyboardType={keyboardType || "default"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.navy,
  },
  appNameRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  appName: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff", letterSpacing: 0.5 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchIcon: { marginRight: 2 },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },

  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  statChipOwner: { backgroundColor: "rgba(201,168,76,0.15)", borderColor: Colors.gold },
  statChipTenant: { backgroundColor: "rgba(59,130,246,0.1)", borderColor: "#93C5FD" },
  statChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
  tenantDot: { backgroundColor: "#3B82F6" },
  statChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  statChipTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },

  list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4, gap: 10 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.gold },
  cardBody: { flex: 1, gap: 5 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  residentName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text, flex: 1 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ownerBadge: { backgroundColor: "rgba(201,168,76,0.15)" },
  tenantBadge: { backgroundColor: "rgba(59,130,246,0.1)" },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  ownerText: { color: Colors.gold },
  tenantText: { color: "#3B82F6" },
  cardMeta: { gap: 3 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.slate, flex: 1 },

  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.slate },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.textSecondary },
  emptySubText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.slate },

  detailContainer: { flex: 1, backgroundColor: Colors.background },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: "#fff",
  },
  closeBtn: { padding: 4 },
  editBtn: { padding: 4 },
  editBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.navy },
  detailHeaderTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.text },

  detailContent: { padding: 20, gap: 16 },
  detailAvatarWrap: { alignItems: "center", gap: 10, paddingBottom: 4 },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  detailAvatarText: { fontFamily: "Inter_700Bold", fontSize: 26, color: Colors.gold },
  detailName: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  detailBadge: { paddingHorizontal: 14, paddingVertical: 4 },

  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  detailRowIcon: { marginTop: 2 },
  detailRowLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.slate, marginBottom: 2 },
  detailRowValue: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },

  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  deleteButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#EF4444" },

  formContent: { padding: 20, gap: 4, paddingBottom: 40 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
  },
  fieldInputMulti: { minHeight: 80, textAlignVertical: "top" },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  toggleActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  toggleText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  toggleTextActive: { color: "#fff" },
});
