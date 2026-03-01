import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";

interface DuesRecord {
  id: string;
  period: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  paid: boolean;
  type: "quarterly" | "special";
}

const SEED_DUES: DuesRecord[] = [
  { id: "1", period: "Q1 2026", amount: 450, dueDate: "2026-03-31", paidDate: null, paid: false, type: "quarterly" },
  { id: "2", period: "Q4 2025", amount: 450, dueDate: "2025-12-31", paidDate: "2025-12-15", paid: true, type: "quarterly" },
  { id: "3", period: "Special Assessment – Roof", amount: 200, dueDate: "2025-11-30", paidDate: "2025-11-20", paid: true, type: "special" },
  { id: "4", period: "Q3 2025", amount: 450, dueDate: "2025-09-30", paidDate: "2025-09-10", paid: true, type: "quarterly" },
  { id: "5", period: "Q2 2025", amount: 450, dueDate: "2025-06-30", paidDate: "2025-06-05", paid: true, type: "quarterly" },
  { id: "6", period: "Q1 2025", amount: 425, dueDate: "2025-03-31", paidDate: "2025-03-20", paid: true, type: "quarterly" },
];

const STORAGE_KEY = "hoa_dues";

const methodIcons: Record<string, any> = {
  card: "card-outline",
  bank: "business-outline",
  check: "document-text-outline",
};

export default function DuesScreen() {
  const insets = useSafeAreaInsets();
  const [dues, setDues] = useState<DuesRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setDues(JSON.parse(data));
      } else {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DUES));
        setDues(SEED_DUES);
      }
    } catch {
      setDues(SEED_DUES);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handlePay = useCallback((record: DuesRecord) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Confirm Payment",
      `Pay $${record.amount} for ${record.period}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pay Now",
          onPress: async () => {
            setPayingId(record.id);
            setTimeout(async () => {
              const updated = dues.map((d) =>
                d.id === record.id
                  ? { ...d, paid: true, paidDate: new Date().toISOString().split("T")[0] }
                  : d
              );
              setDues(updated);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              setPayingId(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Payment Successful", `Your payment of $${record.amount} has been processed.`);
            }, 1500);
          },
        },
      ]
    );
  }, [dues]);

  const unpaid = dues.filter((d) => !d.paid);
  const paid = dues.filter((d) => d.paid);
  const totalPaidYear = paid
    .filter((d) => d.paidDate?.startsWith("2026") || d.period.includes("2026"))
    .reduce((s, d) => s + d.amount, 0);
  const totalOwed = unpaid.reduce((s, d) => s + d.amount, 0);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HOA Dues</Text>
        <Text style={styles.headerSub}>Beyond HOA Community</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: totalOwed > 0 ? Colors.danger : Colors.success }]}>
            <Ionicons name={totalOwed > 0 ? "alert-circle" : "checkmark-circle"} size={24} color={totalOwed > 0 ? Colors.danger : Colors.success} />
            <Text style={styles.summaryLabel}>Amount Due</Text>
            <Text style={[styles.summaryAmount, { color: totalOwed > 0 ? Colors.danger : Colors.success }]}>
              ${totalOwed.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.gold }]}>
            <MaterialCommunityIcons name="cash-check" size={24} color={Colors.gold} />
            <Text style={styles.summaryLabel}>Paid in 2026</Text>
            <Text style={[styles.summaryAmount, { color: Colors.gold }]}>
              ${totalPaidYear.toLocaleString()}
            </Text>
          </View>
        </View>

        {unpaid.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Outstanding Balance</Text>
            {unpaid.map((record) => (
              <View key={record.id} style={[styles.duesCard, styles.unpaidCard]}>
                <View style={styles.duesCardLeft}>
                  <View style={[styles.typeBadge, { backgroundColor: record.type === "special" ? "rgba(231,76,60,0.1)" : "rgba(15,35,64,0.08)" }]}>
                    <Text style={[styles.typeText, { color: record.type === "special" ? Colors.danger : Colors.navy }]}>
                      {record.type === "special" ? "Special" : "Quarterly"}
                    </Text>
                  </View>
                  <Text style={styles.duesPeriod}>{record.period}</Text>
                  <Text style={styles.duesDueDate}>
                    Due {new Date(record.dueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </Text>
                </View>
                <View style={styles.duesCardRight}>
                  <Text style={styles.duesAmount}>${record.amount}</Text>
                  <TouchableOpacity
                    style={styles.payButton}
                    onPress={() => handlePay(record)}
                    disabled={payingId === record.id}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.payButtonText}>
                      {payingId === record.id ? "Processing..." : "Pay Now"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          {paid.map((record) => (
            <View key={record.id} style={styles.duesCard}>
              <View style={styles.duesCardLeft}>
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark" size={12} color={Colors.success} />
                  <Text style={styles.paidText}>Paid</Text>
                </View>
                <Text style={styles.duesPeriod}>{record.period}</Text>
                <Text style={styles.duesDueDate}>
                  {record.paidDate
                    ? `Paid on ${new Date(record.paidDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : ""}
                </Text>
              </View>
              <View style={styles.duesCardRight}>
                <Text style={[styles.duesAmount, { color: Colors.success }]}>${record.amount}</Text>
                <Ionicons name="checkmark-circle" size={22} color={Colors.success} style={{ marginTop: 8 }} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.navy} />
          <Text style={styles.infoText}>
            Quarterly dues are due by the last day of each quarter. Late payments may incur a $50 penalty after 30 days.
          </Text>
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
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.slate, marginTop: 2 },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  summaryAmount: { fontFamily: "Inter_700Bold", fontSize: 26 },
  section: { paddingHorizontal: 16, paddingTop: 24 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text, marginBottom: 12 },
  duesCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  unpaidCard: {
    borderWidth: 1,
    borderColor: "rgba(231,76,60,0.2)",
  },
  duesCardLeft: { flex: 1 },
  duesCardRight: { alignItems: "flex-end" },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  typeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  paidText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.success },
  duesPeriod: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  duesDueDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  duesAmount: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  payButton: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
  },
  payButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.navy },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    margin: 16,
    backgroundColor: "rgba(15,35,64,0.06)",
    padding: 14,
    borderRadius: 12,
    alignItems: "flex-start",
  },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 19 },
});
