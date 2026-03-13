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
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";

interface HoaDocument {
  id: string;
  title: string;
  category: "bylaws" | "rules" | "minutes" | "financial" | "forms" | "legal";
  date: string;
  size: string;
  description: string;
  docPath?: string;
}

const SEED_DOCS: HoaDocument[] = [
  { id: "1", title: "HOA Bylaws – 2024 Revision", category: "bylaws", date: "2024-01-15", size: "1.2 MB", description: "Governing bylaws for Beyond HOA, revised January 2024." },
  { id: "2", title: "Community Rules & Regulations", category: "rules", date: "2024-03-01", size: "856 KB", description: "Complete rules covering landscaping, parking, noise, and pets." },
  { id: "3", title: "Architectural Review Guidelines", category: "rules", date: "2023-11-10", size: "432 KB", description: "Standards and approval process for exterior modifications." },
  { id: "4", title: "Q4 2025 Board Meeting Minutes", category: "minutes", date: "2025-12-20", size: "124 KB", description: "Official minutes from the December quarterly board meeting." },
  { id: "5", title: "Q3 2025 Board Meeting Minutes", category: "minutes", date: "2025-09-18", size: "118 KB", description: "Official minutes from the September quarterly board meeting." },
  { id: "6", title: "Annual Financial Report 2025", category: "financial", date: "2026-01-31", size: "2.1 MB", description: "Year-end financial statements and budget overview for 2025." },
  { id: "7", title: "2026 Operating Budget", category: "financial", date: "2025-12-01", size: "445 KB", description: "Approved operating and reserve budget for fiscal year 2026.", docPath: "/documents/budget-2026" },
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

  const seedMap = Object.fromEntries(SEED_DOCS.map((d) => [d.id, d]));
  const mergePaths = (list: HoaDocument[]) =>
    list.map((d) => ({ ...d, docPath: d.docPath ?? seedMap[d.id]?.docPath }));

  const load = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setDocs(mergePaths(JSON.parse(data)));
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
    const dateStr = new Date(doc.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const buttons: { text: string; style?: "cancel" | "default" | "destructive"; onPress?: () => void }[] = [
      { text: "Close", style: "cancel" },
    ];
    if (doc.docPath) {
      buttons.push({
        text: "View Document",
        onPress: () => {
          const url = new URL(doc.docPath!, getApiUrl()).toString();
          Linking.openURL(url).catch(() =>
            Alert.alert("Unable to open", "Could not open the document. Please try again.")
          );
        },
      });
    }
    Alert.alert(
      doc.title,
      `${doc.description}\n\nFile size: ${doc.size}\nUpdated: ${dateStr}${doc.docPath ? "" : "\n\nDocument not yet available for viewing."}`,
      buttons
    );
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

      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <View style={styles.searchIconWrap}>
            <Ionicons name="search" size={16} color={Colors.textSecondary} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents..."
            placeholderTextColor={Colors.slate}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} activeOpacity={0.7} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={Colors.slate} />
            </TouchableOpacity>
          )}
        </View>
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
              <TouchableOpacity key={doc.id} style={[styles.docCard, !!doc.docPath && styles.docCardLinked]} onPress={() => handleOpen(doc)} activeOpacity={0.75}>
                <View style={[styles.docIcon, { backgroundColor: config.color + "15" }]}>
                  <Ionicons name={config.icon} size={22} color={config.color} />
                </View>
                <View style={styles.docContent}>
                  <View style={styles.docTopRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={[styles.catBadge, { backgroundColor: config.color + "18" }]}>
                        <Text style={[styles.catBadgeText, { color: config.color }]}>{config.label}</Text>
                      </View>
                      {!!doc.docPath && (
                        <View style={styles.availableBadge}>
                          <Ionicons name="open-outline" size={9} color={Colors.success} />
                          <Text style={styles.availableBadgeText}>Available</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.docDate}>{dateStr}</Text>
                  </View>
                  <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                  <Text style={styles.docDesc} numberOfLines={1}>{doc.description}</Text>
                </View>
                <Ionicons name={doc.docPath ? "open-outline" : "chevron-forward"} size={16} color={doc.docPath ? Colors.success : Colors.border} />
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
  searchWrapper: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 8,
  },
  filterScroll: { flexShrink: 0 },
  filterRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
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
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.navy,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
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
  docCardLinked: { borderWidth: 1, borderColor: Colors.success + "40" },
  availableBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: Colors.success + "18", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  availableBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 9, color: Colors.success, textTransform: "uppercase", letterSpacing: 0.4 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.slate },
});
