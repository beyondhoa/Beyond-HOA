import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";

interface HoaDocument {
  id: string;
  title: string;
  category: "bylaws" | "rules" | "minutes" | "financial" | "forms" | "legal";
  date: string;
  size: string;
  description: string;
}

const SEED_DOCS: HoaDocument[] = [
  { id: "1", title: "HOA Bylaws – 2024 Revision", category: "bylaws", date: "2024-01-15", size: "1.2 MB", description: "Governing bylaws for Maple Ridge HOA, revised January 2024." },
  { id: "2", title: "Community Rules & Regulations", category: "rules", date: "2024-03-01", size: "856 KB", description: "Complete rules covering landscaping, parking, noise, and pets." },
  { id: "3", title: "Architectural Review Guidelines", category: "rules", date: "2023-11-10", size: "432 KB", description: "Standards and approval process for exterior modifications." },
  { id: "4", title: "Q4 2025 Board Meeting Minutes", category: "minutes", date: "2025-12-20", size: "124 KB", description: "Official minutes from the December quarterly board meeting." },
  { id: "5", title: "Q3 2025 Board Meeting Minutes", category: "minutes", date: "2025-09-18", size: "118 KB", description: "Official minutes from the September quarterly board meeting." },
  { id: "6", title: "Annual Financial Report 2025", category: "financial", date: "2026-01-31", size: "2.1 MB", description: "Year-end financial statements and budget overview for 2025." },
  { id: "7", title: "2026 Operating Budget", category: "financial", date: "2025-12-01", size: "445 KB", description: "Approved operating and reserve budget for fiscal year 2026." },
  { id: "8", title: "Architectural Request Form", category: "forms", date: "2024-01-01", size: "88 KB", description: "Submit for any exterior changes requiring board approval." },
  { id: "9", title: "Move-In/Out Request Form", category: "forms", date: "2024-01-01", size: "56 KB", description: "Required for scheduling elevator and loading dock access." },
  { id: "10", title: "CC&Rs – Declaration of Covenants", category: "legal", date: "2015-06-10", size: "3.4 MB", description: "Original Declaration of Covenants, Conditions, and Restrictions." },
  { id: "11", title: "Reserve Study 2024–2034", category: "financial", date: "2024-07-01", size: "1.8 MB", description: "10-year reserve study and funding plan for major repairs." },
  { id: "12", title: "Pet Policy Addendum", category: "rules", date: "2023-05-15", size: "92 KB", description: "Updated pet registration requirements and breed restrictions." },
];

const STORAGE_KEY = "hoa_documents";

const categoryConfig: Record<string, { label: string; color: string; icon: any }> = {
  bylaws: { label: "Bylaws", color: Colors.navy, icon: "book" },
  rules: { label: "Rules", color: "#7C3AED", icon: "shield-checkmark" },
  minutes: { label: "Minutes", color: "#0891B2", icon: "people" },
  financial: { label: "Financial", color: Colors.success, icon: "bar-chart" },
  forms: { label: "Forms", color: Colors.warning, icon: "document-text" },
  legal: { label: "Legal", color: Colors.danger, icon: "briefcase" },
};

const CATEGORIES = ["all", "bylaws", "rules", "minutes", "financial", "forms", "legal"] as const;

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const [docs, setDocs] = useState<HoaDocument[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setDocs(JSON.parse(data));
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DOCS));
        setDocs(SEED_DOCS);
      }
    } catch {
      setDocs(SEED_DOCS);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleOpen = (doc: HoaDocument) => {
    Haptics.selectionAsync();
    Alert.alert(doc.title, `${doc.description}\n\nFile size: ${doc.size}\nUpdated: ${new Date(doc.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, [
      { text: "Close", style: "cancel" },
      { text: "View Document", onPress: () => {} },
    ]);
  };

  const filtered = docs
    .filter((d) => filter === "all" || d.category === filter)
    .filter((d) =>
      !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.description.toLowerCase().includes(search.toLowerCase())
    );

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Documents</Text>
        <Text style={styles.headerSub}>{docs.length} community documents</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={Colors.slate} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search documents..."
          placeholderTextColor={Colors.slate}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={Colors.slate} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterChip, filter === cat && styles.filterChipActive]}
            onPress={() => { Haptics.selectionAsync(); setFilter(cat); }}
            activeOpacity={0.7}
          >
            {cat !== "all" && (
              <Ionicons
                name={categoryConfig[cat]?.icon}
                size={12}
                color={filter === cat ? Colors.navy : Colors.slate}
              />
            )}
            <Text style={[styles.filterChipText, filter === cat && styles.filterChipTextActive]}>
              {cat === "all" ? "All" : categoryConfig[cat]?.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        <View style={styles.list}>
          {filtered.map((doc) => {
            const config = categoryConfig[doc.category];
            const dateStr = new Date(doc.date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
            return (
              <TouchableOpacity key={doc.id} style={styles.docCard} onPress={() => handleOpen(doc)} activeOpacity={0.75}>
                <View style={[styles.docIcon, { backgroundColor: config.color + "15" }]}>
                  <Ionicons name={config.icon} size={22} color={config.color} />
                </View>
                <View style={styles.docContent}>
                  <View style={styles.docTopRow}>
                    <View style={[styles.catBadge, { backgroundColor: config.color + "18" }]}>
                      <Text style={[styles.catBadgeText, { color: config.color }]}>{config.label}</Text>
                    </View>
                    <Text style={styles.docDate}>{dateStr}</Text>
                  </View>
                  <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                  <Text style={styles.docDesc} numberOfLines={1}>{doc.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.border} />
              </TouchableOpacity>
            );
          })}
          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="file-search-outline" size={48} color={Colors.slate} />
              <Text style={styles.emptyText}>No documents found</Text>
            </View>
          )}
        </View>
        <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: Colors.navy,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.slate, marginTop: 2 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.navyLight,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#fff",
  },
  filterScroll: { maxHeight: 52 },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  filterChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.navy,
    fontFamily: "Inter_600SemiBold",
  },
  list: { padding: 16, gap: 10 },
  docCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  docContent: { flex: 1 },
  docTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  catBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  docDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  docTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  docDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.slate },
});
