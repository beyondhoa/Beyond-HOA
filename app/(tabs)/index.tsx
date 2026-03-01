import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";

interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  pinned: boolean;
  category: "general" | "maintenance" | "event" | "urgent";
}

const SEED_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "1",
    title: "Pool Closure – Scheduled Maintenance",
    body: "The community pool will be closed March 5–7 for annual maintenance. We apologize for the inconvenience.",
    date: "2026-03-01",
    pinned: true,
    category: "maintenance",
  },
  {
    id: "2",
    title: "Spring Community Cleanup Day",
    body: "Join your neighbors on March 15 at 9 AM for our annual spring cleanup. Refreshments provided!",
    date: "2026-02-28",
    pinned: false,
    category: "event",
  },
  {
    id: "3",
    title: "Q1 Board Meeting – March 20",
    body: "The quarterly board meeting will be held in the community center at 7 PM. All residents welcome.",
    date: "2026-02-25",
    pinned: false,
    category: "general",
  },
  {
    id: "4",
    title: "Updated Parking Policy",
    body: "Effective April 1, all guest vehicles must display a visitor pass. Passes available at the management office.",
    date: "2026-02-20",
    pinned: false,
    category: "general",
  },
];

const STORAGE_KEY = "hoa_announcements";

const categoryConfig = {
  general: { color: Colors.navy, icon: "information-circle" as const },
  maintenance: { color: Colors.warning, icon: "construct" as const },
  event: { color: Colors.success, icon: "calendar" as const },
  urgent: { color: Colors.danger, icon: "alert-circle" as const },
};

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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [duesStatus, setDuesStatus] = useState({ paid: false, amount: 450, dueDate: "2026-03-31" });
  const [activeVotes, setActiveVotes] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setAnnouncements(JSON.parse(stored));
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ANNOUNCEMENTS));
        setAnnouncements(SEED_ANNOUNCEMENTS);
      }

      const duesData = await AsyncStorage.getItem("hoa_dues");
      if (duesData) {
        const dues = JSON.parse(duesData);
        const currentRecord = dues.find((d: any) => d.period === "Q1 2026");
        if (currentRecord) setDuesStatus({ paid: currentRecord.paid, amount: currentRecord.amount, dueDate: currentRecord.dueDate });
      }

      const votesData = await AsyncStorage.getItem("hoa_votes");
      if (votesData) {
        const votes = JSON.parse(votesData);
        const active = votes.filter((v: any) => v.status === "active").length;
        setActiveVotes(active);
      } else {
        setActiveVotes(2);
      }
    } catch (e) {
      setAnnouncements(SEED_ANNOUNCEMENTS);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleBoardPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/board");
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning,</Text>
          <Text style={styles.name}>Beyond HOA</Text>
        </View>
        <TouchableOpacity style={styles.boardButton} onPress={handleBoardPress} activeOpacity={0.8}>
          <MaterialCommunityIcons name="shield-star" size={18} color={Colors.gold} />
          <Text style={styles.boardButtonText}>Board</Text>
        </TouchableOpacity>
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
          <Text style={styles.sectionTitle}>Community Announcements</Text>
          {sortedAnnouncements.map((item) => (
            <AnnouncementCard key={item.id} item={item} />
          ))}
          {sortedAnnouncements.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="megaphone-outline" size={40} color={Colors.slate} />
              <Text style={styles.emptyText}>No announcements yet</Text>
            </View>
          )}
        </View>

        <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
    backgroundColor: Colors.navy,
  },
  greeting: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.slate,
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#fff",
    marginTop: 2,
  },
  boardButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(201,168,76,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.3)",
  },
  boardButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.gold,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    marginBottom: 8,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.text,
    marginTop: 4,
  },
  statSub: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.text,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.text,
    marginBottom: 12,
  },
  announcementCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  pinnedCard: {
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.3)",
    backgroundColor: "rgba(201,168,76,0.04)",
  },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 8,
  },
  pinnedText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: Colors.gold,
    letterSpacing: 1,
  },
  announcementHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  categoryDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  announcementDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  announcementTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
    marginBottom: 4,
  },
  announcementBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.slate,
  },
});
