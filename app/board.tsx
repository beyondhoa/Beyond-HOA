import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";

interface BoardMember {
  name: string;
  role: string;
  since: string;
}

interface ActionItem {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  category: string;
}

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

const adminTools = [
  { id: "announce", icon: "megaphone", label: "New Announcement", color: Colors.navy },
  { id: "vote", icon: "checkmark-circle", label: "Create Ballot", color: "#7C3AED" },
  { id: "notice", icon: "mail", label: "Send Notice", color: Colors.warning },
  { id: "violation", icon: "alert-circle", label: "Log Violation", color: Colors.danger },
  { id: "maintenance", icon: "construct", label: "Work Order", color: "#0891B2" },
  { id: "report", icon: "bar-chart", label: "Generate Report", color: Colors.success },
];

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handleToolPress = (tool: typeof adminTools[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(tool.label, "This feature is coming soon in the next update.", [{ text: "OK" }]);
  };

  const toggleItem = (id: string) => {
    Haptics.selectionAsync();
    setCompletedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const pendingCount = ACTION_ITEMS.length - completedItems.length;

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

      <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>MAPLE RIDGE HOA</Text>
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
              <Text style={styles.heroStatValue}>$184K</Text>
              <Text style={styles.heroStatLabel}>Reserve Fund</Text>
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
          <View style={[styles.meetingCard]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  heroCard: {
    margin: 16,
    backgroundColor: Colors.navy,
    borderRadius: 18,
    padding: 20,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  heroLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.gold,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  heroBadge: {
    backgroundColor: "rgba(201,168,76,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.3)",
  },
  heroBadgeText: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.gold },
  heroStats: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
    gap: 0,
  },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff" },
  heroStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.slate, marginTop: 2 },
  heroStatDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 4 },
  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.text,
    marginBottom: 12,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  toolCard: {
    width: "30.5%",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  toolLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.text,
    textAlign: "center",
    lineHeight: 14,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  actionItemDone: { opacity: 0.5 },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  actionItemContent: { flex: 1 },
  actionItemTitle: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  actionItemTitleDone: { textDecorationLine: "line-through", color: Colors.slate },
  actionItemCategory: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  priorityDot: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  priorityText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInitials: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.gold },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  memberRole: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  memberSince: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.slate },
  meetingCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.25)",
    marginBottom: 16,
  },
  meetingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(201,168,76,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  meetingLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  meetingDate: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.text },
  meetingLocation: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  meetingBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  meetingBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.navy },
});
