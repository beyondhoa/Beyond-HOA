import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/query-client";

interface HoaDocument {
  id: number;
  title: string;
  category: "bylaws" | "rules" | "minutes" | "financial" | "forms" | "legal";
  doc_date: string;
  file_size: string | null;
  description: string | null;
  doc_path: string | null;
}

const categoryConfig: Record<string, { label: string; color: string; icon: any }> = {
  bylaws:    { label: "Bylaws",    color: Colors.navy,    icon: "book" },
  rules:     { label: "Rules",     color: "#7C3AED",      icon: "shield-checkmark" },
  minutes:   { label: "Minutes",   color: "#0891B2",      icon: "people" },
  financial: { label: "Financial", color: Colors.success, icon: "bar-chart" },
  forms:     { label: "Forms",     color: Colors.warning, icon: "document-text" },
  legal:     { label: "Legal",     color: Colors.danger,  icon: "briefcase" },
};

const CATEGORIES = ["all", "bylaws", "rules", "minutes", "financial", "forms", "legal"] as const;

async function openDocUrl(docPath: string) {
  const url = new URL(docPath, getApiUrl()).toString();
  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    });
  }
}

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<HoaDocument | null>(null);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: docs = [], isFetching, refetch } = useQuery<HoaDocument[]>({
    queryKey: ["/api/documents"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const filtered = docs
    .filter((d) => filter === "all" || d.category === filter)
    .filter((d) =>
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      (d.description ?? "").toLowerCase().includes(search.toLowerCase())
    );

  const selectedConfig = selectedDoc ? categoryConfig[selectedDoc.category] : null;

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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
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
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={Colors.gold}
          />
        }
      >
        <View style={styles.list}>
          {filtered.map((doc) => {
            const config = categoryConfig[doc.category];
            const dateStr = new Date(doc.doc_date).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            });
            return (
              <TouchableOpacity
                key={doc.id}
                style={[styles.docCard, !!doc.doc_path && styles.docCardLinked]}
                onPress={() => { Haptics.selectionAsync(); setSelectedDoc(doc); }}
                activeOpacity={0.75}
              >
                <View style={[styles.docIcon, { backgroundColor: config.color + "15" }]}>
                  <Ionicons name={config.icon} size={22} color={config.color} />
                </View>
                <View style={styles.docContent}>
                  <View style={styles.docTopRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={[styles.catBadge, { backgroundColor: config.color + "18" }]}>
                        <Text style={[styles.catBadgeText, { color: config.color }]}>{config.label}</Text>
                      </View>
                      {!!doc.doc_path && (
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
                <Ionicons
                  name={doc.doc_path ? "open-outline" : "chevron-forward"}
                  size={16}
                  color={doc.doc_path ? Colors.success : Colors.border}
                />
              </TouchableOpacity>
            );
          })}
          {filtered.length === 0 && !isFetching && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="file-search-outline" size={48} color={Colors.slate} />
              <Text style={styles.emptyText}>
                {docs.length === 0 ? "Loading documents…" : "No documents found"}
              </Text>
            </View>
          )}
        </View>
        <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
      </ScrollView>

      {/* Document Detail Modal */}
      <Modal
        visible={!!selectedDoc}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDoc(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedDoc(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {selectedDoc && selectedConfig && (
              <>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <View style={[styles.modalDocIcon, { backgroundColor: selectedConfig.color + "18" }]}>
                    <Ionicons name={selectedConfig.icon} size={28} color={selectedConfig.color} />
                  </View>
                  <View style={styles.modalHeaderText}>
                    <View style={[styles.catBadge, { backgroundColor: selectedConfig.color + "18", alignSelf: "flex-start", marginBottom: 6 }]}>
                      <Text style={[styles.catBadgeText, { color: selectedConfig.color }]}>{selectedConfig.label}</Text>
                    </View>
                    <Text style={styles.modalTitle}>{selectedDoc.title}</Text>
                  </View>
                </View>

                <Text style={styles.modalDesc}>{selectedDoc.description}</Text>

                <View style={styles.modalMeta}>
                  <View style={styles.modalMetaItem}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.modalMetaText}>
                      {new Date(selectedDoc.doc_date).toLocaleDateString("en-US", {
                        month: "long", day: "numeric", year: "numeric",
                      })}
                    </Text>
                  </View>
                  {selectedDoc.file_size && (
                    <View style={styles.modalMetaItem}>
                      <Ionicons name="document-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.modalMetaText}>{selectedDoc.file_size}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setSelectedDoc(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.closeBtnText}>Close</Text>
                  </TouchableOpacity>
                  {selectedDoc.doc_path ? (
                    <TouchableOpacity
                      style={styles.viewBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedDoc(null);
                        openDocUrl(selectedDoc.doc_path!);
                      }}
                    >
                      <Ionicons name="open-outline" size={16} color="#fff" />
                      <Text style={styles.viewBtnText}>View Document</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.viewBtn, { opacity: 0.4 }]}>
                      <Ionicons name="time-outline" size={16} color="#fff" />
                      <Text style={styles.viewBtnText}>Coming Soon</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4,
    backgroundColor: Colors.navy,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 18, color: Colors.cream, marginTop: 2 },
  searchWrapper: {
    backgroundColor: Colors.background, paddingHorizontal: 16,
    paddingTop: 14, paddingBottom: 6,
  },
  searchContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 4, paddingVertical: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  searchIconWrap: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  clearBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  searchInput: {
    flex: 1, fontFamily: "Inter_400Regular", fontSize: 14,
    color: Colors.text, paddingVertical: 8,
  },
  filterScroll: { flexShrink: 0 },
  filterRow: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    gap: 8, flexDirection: "row", alignItems: "center",
  },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filterChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.navy, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  list: { padding: 16, gap: 10 },
  docCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  docIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  docContent: { flex: 1 },
  docTopRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 4,
  },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  catBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  docDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  docTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  docDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  docCardLinked: { borderWidth: 1, borderColor: Colors.success + "40" },
  availableBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.success + "18", paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 6,
  },
  availableBadgeText: {
    fontFamily: "Inter_600SemiBold", fontSize: 9, color: Colors.success,
    textTransform: "uppercase", letterSpacing: 0.4,
  },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.slate },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === "web" ? 34 : 40,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: "center", marginBottom: 20,
  },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 14 },
  modalDocIcon: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  modalHeaderText: { flex: 1 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text, lineHeight: 24 },
  modalDesc: {
    fontFamily: "Inter_400Regular", fontSize: 14,
    color: Colors.textSecondary, lineHeight: 21, marginBottom: 16,
  },
  modalMeta: {
    flexDirection: "row", gap: 20, marginBottom: 24,
    paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  modalMetaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  modalMetaText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  modalActions: { flexDirection: "row", gap: 12 },
  closeBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  closeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textSecondary },
  viewBtn: {
    flex: 2, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, paddingVertical: 14,
    borderRadius: 14, backgroundColor: Colors.navy,
  },
  viewBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
});
