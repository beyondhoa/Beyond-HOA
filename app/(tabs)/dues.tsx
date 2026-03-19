import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  RefreshControl,
  Linking,
  AppState,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/query-client";

interface DuesRecord {
  id: string;
  period: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  paid: boolean;
  type: "quarterly" | "special";
}

interface DuesPayment {
  id: number;
  dues_id: string;
  period: string;
  amount: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  status: "pending" | "paid" | "failed";
  paid_at: string | null;
  created_at: string;
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

function apiUrl(path: string) {
  return new URL(path, getApiUrl()).toString();
}

export default function DuesScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [dues, setDues] = useState<DuesRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const { data: paymentsFromServer = [] } = useQuery<DuesPayment[]>({
    queryKey: ["/api/dues/payments"],
    refetchInterval: 10000,
  });

  const { data: stripeStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/dues/stripe-configured"],
    refetchInterval: false,
  });
  const stripeConfigured = stripeStatus?.configured ?? false;

  const paidDuesIds = new Set(
    paymentsFromServer.filter((p) => p.status === "paid").map((p) => p.dues_id)
  );

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

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        queryClient.invalidateQueries({ queryKey: ["/api/dues/payments"] });
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [queryClient]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      load(),
      queryClient.invalidateQueries({ queryKey: ["/api/dues/payments"] }),
    ]);
    setRefreshing(false);
  }, [load, queryClient]);

  const handlePay = useCallback(async (record: DuesRecord) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!stripeConfigured) {
      Alert.alert(
        "Payment Setup Required",
        "Stripe payments are not yet configured. A board member can connect Stripe in the Board tab under Payment Setup.",
        [{ text: "OK" }]
      );
      return;
    }

    setPayingId(record.id);
    try {
      const res = await fetch(apiUrl("/api/dues/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duesId: record.id,
          period: record.period,
          amount: record.amount,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Checkout failed");
      }

      const { url } = await res.json();
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert("Payment Error", err.message ?? "Failed to open payment page. Please try again.");
    } finally {
      setPayingId(null);
    }
  }, [stripeConfigured]);

  const displayedDues = dues.map((d) => ({
    ...d,
    paid: d.paid || paidDuesIds.has(d.id),
    paidDate: paidDuesIds.has(d.id)
      ? paymentsFromServer.find((p) => p.dues_id === d.id && p.status === "paid")?.paid_at?.split("T")[0] ?? d.paidDate
      : d.paidDate,
    paidViaStripe: paidDuesIds.has(d.id),
  }));

  const unpaid = displayedDues.filter((d) => !d.paid);
  const paid = displayedDues.filter((d) => d.paid);
  const totalPaidYear = paid
    .filter((d) => d.paidDate?.startsWith("2026") || d.period.includes("2026"))
    .reduce((s, d) => s + d.amount, 0);
  const totalOwed = unpaid.reduce((s, d) => s + d.amount, 0);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>HOA Dues</Text>
          <Text style={styles.headerSub}>Beyond HOA Community</Text>
        </View>
        <View style={styles.stripeBadge}>
          <Ionicons name="shield-checkmark" size={12} color="#635BFF" />
          <Text style={styles.stripeBadgeText}>Stripe Secured</Text>
        </View>
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
                    style={[styles.payButton, payingId === record.id && styles.payButtonLoading]}
                    onPress={() => handlePay(record)}
                    disabled={payingId !== null}
                    activeOpacity={0.8}
                  >
                    {payingId === record.id ? (
                      <View style={styles.payButtonInner}>
                        <ActivityIndicator size="small" color={Colors.navy} />
                        <Text style={styles.payButtonText}>Opening...</Text>
                      </View>
                    ) : (
                      <View style={styles.payButtonInner}>
                        <Ionicons name="card" size={14} color={Colors.navy} />
                        <Text style={styles.payButtonText}>Pay Now</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {stripeConfigured ? (
              <View style={styles.stripeInfoBox}>
                <Ionicons name="lock-closed" size={14} color="#635BFF" />
                <Text style={styles.stripeInfoText}>
                  Payments are processed securely by Stripe. Your card details are never stored by Beyond HOA.
                </Text>
              </View>
            ) : (
              <View style={[styles.stripeInfoBox, { borderColor: "rgba(201,168,76,0.3)", backgroundColor: "rgba(201,168,76,0.06)" }]}>
                <Ionicons name="alert-circle" size={14} color={Colors.gold} />
                <Text style={[styles.stripeInfoText, { color: Colors.textSecondary }]}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: Colors.text }}>Payments not yet enabled.</Text>
                  {" "}A board member can connect Stripe under{" "}
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: Colors.navy }}>Board → Payment Setup</Text>.
                </Text>
              </View>
            )}
          </View>
        )}

        {unpaid.length === 0 && (
          <View style={styles.allPaidBanner}>
            <Ionicons name="checkmark-circle" size={36} color={Colors.success} />
            <Text style={styles.allPaidTitle}>All Dues Paid</Text>
            <Text style={styles.allPaidSub}>You're all caught up — no outstanding balance.</Text>
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
                  {(record as any).paidViaStripe && (
                    <View style={styles.stripePill}>
                      <Text style={styles.stripePillText}>Stripe</Text>
                    </View>
                  )}
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
            Quarterly dues are due by the last day of each quarter. Late payments may incur a $50 penalty after 30 days. Pull to refresh after completing payment to see your updated status.
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.slate, marginTop: 2 },
  stripeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(99,91,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(99,91,255,0.3)",
  },
  stripeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#9E97FF" },
  summaryRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 16, borderLeftWidth: 3, gap: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  summaryAmount: { fontFamily: "Inter_700Bold", fontSize: 26 },
  section: { paddingHorizontal: 16, paddingTop: 24 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text, marginBottom: 12 },
  duesCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  unpaidCard: { borderWidth: 1, borderColor: "rgba(231,76,60,0.2)" },
  duesCardLeft: { flex: 1 },
  duesCardRight: { alignItems: "flex-end" },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6 },
  typeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  paidBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  paidText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.success },
  stripePill: { backgroundColor: "rgba(99,91,255,0.12)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  stripePillText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#635BFF" },
  duesPeriod: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  duesDueDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  duesAmount: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  payButton: {
    backgroundColor: Colors.gold, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 20, marginTop: 8, minWidth: 110,
  },
  payButtonLoading: { opacity: 0.7 },
  payButtonInner: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  payButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.navy },
  stripeInfoBox: {
    flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 8,
    backgroundColor: "rgba(99,91,255,0.06)", padding: 12, borderRadius: 10,
    alignItems: "flex-start", borderWidth: 1, borderColor: "rgba(99,91,255,0.12)",
  },
  stripeInfoText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  allPaidBanner: { alignItems: "center", padding: 32, gap: 10 },
  allPaidTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.success },
  allPaidSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary },
  infoBox: {
    flexDirection: "row", gap: 10, margin: 16,
    backgroundColor: "rgba(15,35,64,0.06)", padding: 14, borderRadius: 12, alignItems: "flex-start",
  },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, flex: 1, lineHeight: 19 },
});
