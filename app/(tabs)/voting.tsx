import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

interface VoteOption {
  id: string;
  label: string;
  votes: number;
}

interface Vote {
  id: string;
  title: string;
  description: string;
  status: "active" | "closed";
  deadline: string;
  options: VoteOption[];
  userVote: string | null;
  totalVoters: number;
}

const SEED_VOTES: Vote[] = [
  {
    id: "1",
    title: "New Playground Equipment",
    description: "Should the HOA allocate $15,000 from the reserve fund to replace the aging playground equipment at Elm Park?",
    status: "active",
    deadline: "2026-03-20",
    options: [
      { id: "yes", label: "Approve", votes: 34 },
      { id: "no", label: "Reject", votes: 12 },
      { id: "defer", label: "Defer to Next Quarter", votes: 8 },
    ],
    userVote: null,
    totalVoters: 120,
  },
  {
    id: "2",
    title: "Guest Parking Hours",
    description: "Extend guest parking from 10 PM to midnight on weekends to accommodate residents with evening guests.",
    status: "active",
    deadline: "2026-03-25",
    options: [
      { id: "yes", label: "Support Extension", votes: 58 },
      { id: "no", label: "Keep Current Hours", votes: 29 },
    ],
    userVote: null,
    totalVoters: 120,
  },
  {
    id: "3",
    title: "Community Garden Expansion",
    description: "Expand the community garden from 20 to 40 plots by converting the unused lawn area near Gate B.",
    status: "closed",
    deadline: "2026-02-15",
    options: [
      { id: "yes", label: "Approve", votes: 72 },
      { id: "no", label: "Reject", votes: 31 },
    ],
    userVote: "yes",
    totalVoters: 120,
  },
  {
    id: "4",
    title: "Pool Hours Adjustment",
    description: "Extend summer pool hours from 9 PM to 10 PM to accommodate working residents.",
    status: "closed",
    deadline: "2026-01-30",
    options: [
      { id: "yes", label: "Approve", votes: 45 },
      { id: "no", label: "Keep Current", votes: 61 },
    ],
    userVote: "no",
    totalVoters: 120,
  },
];

const STORAGE_KEY = "hoa_votes";

function VoteBar({ option, total, isWinner }: { option: VoteOption; total: number; isWinner: boolean }) {
  const pct = total > 0 ? option.votes / total : 0;
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(pct, { duration: 600 });
  }, [pct]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View style={styles.voteBarContainer}>
      <View style={styles.voteBarTrack}>
        <Animated.View style={[styles.voteBarFill, barStyle, isWinner && styles.voteBarWinner]} />
      </View>
    </View>
  );
}

function VoteCard({ vote, onVote }: { vote: Vote; onVote: (voteId: string, optionId: string) => void }) {
  const totalVotes = vote.options.reduce((s, o) => s + o.votes, 0);
  const deadline = new Date(vote.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const maxVotes = Math.max(...vote.options.map(o => o.votes));
  const isActive = vote.status === "active";

  return (
    <View style={[styles.voteCard, !isActive && styles.closedCard]}>
      <View style={styles.voteCardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? "rgba(46,204,113,0.1)" : "rgba(138,155,176,0.1)" }]}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.success : Colors.slate }]} />
          <Text style={[styles.statusText, { color: isActive ? Colors.success : Colors.slate }]}>
            {isActive ? "Active" : "Closed"}
          </Text>
        </View>
        <Text style={styles.deadlineText}>
          <Ionicons name="time-outline" size={11} color={Colors.textSecondary} /> {isActive ? "Ends" : "Ended"} {deadline}
        </Text>
      </View>

      <Text style={styles.voteTitle}>{vote.title}</Text>
      <Text style={styles.voteDesc}>{vote.description}</Text>

      <View style={styles.optionsContainer}>
        {vote.options.map((option) => {
          const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const isWinner = option.votes === maxVotes && !isActive;
          const isSelected = vote.userVote === option.id;

          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionRow,
                isSelected && styles.optionSelected,
                (!isActive || vote.userVote) && styles.optionDisabled,
              ]}
              onPress={() => isActive && !vote.userVote && onVote(vote.id, option.id)}
              activeOpacity={isActive && !vote.userVote ? 0.7 : 1}
            >
              <View style={styles.optionTop}>
                <View style={styles.optionLabelRow}>
                  {isSelected && <Ionicons name="checkmark-circle" size={16} color={Colors.gold} style={{ marginRight: 6 }} />}
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>{option.label}</Text>
                </View>
                <Text style={[styles.optionPct, isWinner && styles.optionPctWinner]}>{pct}%</Text>
              </View>
              {(vote.userVote || !isActive) && (
                <VoteBar option={option} total={totalVotes} isWinner={isWinner} />
              )}
              <Text style={styles.optionVotes}>{option.votes} votes</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.voterCount}>{totalVotes} of {vote.totalVoters} residents voted</Text>
    </View>
  );
}

export default function VotingScreen() {
  const insets = useSafeAreaInsets();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "closed">("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setVotes(JSON.parse(data));
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_VOTES));
        setVotes(SEED_VOTES);
      }
    } catch {
      setVotes(SEED_VOTES);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleVote = useCallback(async (voteId: string, optionId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated = votes.map((v) => {
      if (v.id !== voteId) return v;
      return {
        ...v,
        userVote: optionId,
        options: v.options.map((o) =>
          o.id === optionId ? { ...o, votes: o.votes + 1 } : o
        ),
      };
    });
    setVotes(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    Alert.alert("Vote Cast", "Your vote has been recorded.", [{ text: "OK" }]);
  }, [votes]);

  const filtered = votes.filter((v) => filter === "all" || v.status === filter);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community Voting</Text>
        <Text style={styles.headerSub}>{votes.filter(v => v.status === "active").length} active ballots</Text>
      </View>

      <View style={styles.filterRow}>
        {(["all", "active", "closed"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setFilter(f); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        <View style={styles.list}>
          {filtered.map((v) => (
            <VoteCard key={v.id} vote={v} onVote={handleVote} />
          ))}
          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.slate} />
              <Text style={styles.emptyText}>No {filter !== "all" ? filter : ""} ballots</Text>
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
    paddingBottom: 16,
    paddingTop: 8,
    backgroundColor: Colors.navy,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#fff",
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.c,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.navy,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  filterBtnActive: {
    backgroundColor: Colors.gold,
  },
  filterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.slate,
  },
  filterTextActive: {
    color: Colors.navy,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    padding: 16,
    gap: 14,
  },
  voteCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  closedCard: {
    opacity: 0.85,
  },
  voteCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  deadlineText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  voteTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text, marginBottom: 6 },
  voteDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 16 },
  optionsContainer: { gap: 10 },
  optionRow: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  optionSelected: {
    borderColor: Colors.gold,
    backgroundColor: "rgba(201,168,76,0.06)",
  },
  optionDisabled: {},
  optionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  optionLabelRow: { flexDirection: "row", alignItems: "center" },
  optionLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  optionLabelSelected: { fontFamily: "Inter_600SemiBold", color: Colors.navy },
  optionPct: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  optionPctWinner: { color: Colors.gold },
  optionVotes: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  voteBarContainer: { marginBottom: 2 },
  voteBarTrack: { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: "hidden" },
  voteBarFill: { height: "100%", backgroundColor: Colors.navyLight, borderRadius: 2 },
  voteBarWinner: { backgroundColor: Colors.gold },
  voterCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 14, textAlign: "center" },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.slate },
});
