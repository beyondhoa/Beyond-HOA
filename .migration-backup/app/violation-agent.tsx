import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Platform, Image, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/query-client";

const Colors = {
  navy: "#0F2340",
  gold: "#C9A84C",
  white: "#FFFFFF",
  bg: "#F5F6F8",
  card: "#FFFFFF",
  border: "#E5E8EE",
  text: "#1A2235",
  muted: "#7A8599",
  danger: "#C0392B",
  success: "#27AE60",
  warning: "#E67E22",
  accent: "#1A4A8A",
};

const VIOLATION_TYPES = [
  "Landscaping / Lawn Care",
  "Parking Violation",
  "Noise / Nuisance",
  "Pet Policy",
  "Architectural Modification",
  "Trash / Debris",
  "Common Area Misuse",
  "Short-Term Rental",
  "Other",
];

interface Vendor {
  id: number;
  name: string;
  specialty: string;
  phone: string | null;
  email: string | null;
}

interface Analysis {
  violation_type: string;
  description: string;
  required_action: string;
  severity: "low" | "medium" | "high";
  fine_suggestion: number | null;
  compliance_days: number;
  summary: string;
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

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function deadlineStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function severityColor(s: string) {
  if (s === "high") return Colors.danger;
  if (s === "medium") return Colors.warning;
  return Colors.success;
}

type Step = "capture" | "analyzing" | "review" | "vendor" | "confirm" | "done";

export default function ViolationAgentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("capture");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const [form, setForm] = useState({
    resident_name: "",
    unit: "",
    violation_type: "Other",
    notice_number: "1",
    incident_date: todayStr(),
    description: "",
    required_action: "",
    compliance_deadline: deadlineStr(14),
    fine_amount: "",
    issued_by: "",
    notes: "",
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });

  const suggestVendor = useCallback((vtype: string, vendorList: Vendor[]) => {
    const match = vendorList.find((v) =>
      v.specialty.toLowerCase().includes(vtype.toLowerCase().split(" ")[0].toLowerCase()) ||
      vtype.toLowerCase().includes(v.specialty.toLowerCase().split(" ")[0].toLowerCase())
    );
    return match ?? vendorList.find((v) => v.specialty === "General Compliance") ?? null;
  }, []);

  const submitMutation = useMutation({
    mutationFn: (payload: object) => apiRequest("POST", "/api/violations", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/violations"] });
      setStep("done");
    },
  });

  const pickImage = async (fromCamera: boolean) => {
    let result: ImagePicker.ImagePickerResult;
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.7,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.7,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
    }
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 ?? null);
    }
  };

  const runAnalysis = async () => {
    if (!imageBase64) return;
    setStep("analyzing");
    setAnalyzeError(null);
    try {
      const url = new URL("/api/violations/analyze-image", getApiUrl()).toString();
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: "image/jpeg" }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: Analysis = await resp.json();
      setAnalysis(data);
      setForm((f) => ({
        ...f,
        violation_type: data.violation_type ?? f.violation_type,
        description: data.description ?? "",
        required_action: data.required_action ?? "",
        fine_amount: data.fine_suggestion ? String(data.fine_suggestion) : "",
        compliance_deadline: deadlineStr(data.compliance_days ?? 14),
        notes: `AI Severity: ${data.severity ?? "medium"}`,
      }));
      const suggested = suggestVendor(data.violation_type ?? "", vendors);
      setSelectedVendor(suggested);
      setStep("review");
    } catch (e) {
      setAnalyzeError("Analysis failed. Please try again.");
      setStep("capture");
    }
  };

  const handleSubmit = () => {
    submitMutation.mutate({
      ...form,
      notice_number: Number(form.notice_number) || 1,
      fine_amount: form.fine_amount || null,
      photo_url: imageUri ?? null,
      assigned_vendor: selectedVendor ? selectedVendor.name : null,
    });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (step === "done") {
    return (
      <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
        <View style={styles.doneWrap}>
          <View style={styles.doneIconCircle}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
          </View>
          <Text style={styles.doneTitle}>Violation Filed</Text>
          <Text style={styles.doneSub}>
            The notice has been created{selectedVendor ? ` and assigned to ${selectedVendor.name}` : ""}.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Back to Board</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.navy} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Violation Agent</Text>
          <Text style={styles.headerSub}>AI-Powered Compliance</Text>
        </View>
        <View style={styles.agentBadge}>
          <Ionicons name="sparkles" size={14} color={Colors.gold} />
          <Text style={styles.agentBadgeText}>AI</Text>
        </View>
      </View>

      <StepIndicator current={step} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {(step === "capture") && (
          <CaptureStep
            imageUri={imageUri}
            analyzeError={analyzeError}
            onCamera={() => pickImage(true)}
            onGallery={() => pickImage(false)}
            onAnalyze={runAnalysis}
            canAnalyze={!!imageBase64}
          />
        )}

        {step === "analyzing" && <AnalyzingStep />}

        {(step === "review" || step === "vendor") && analysis && (
          <ReviewStep
            step={step}
            setStep={setStep}
            form={form}
            setForm={setForm}
            analysis={analysis}
            imageUri={imageUri}
            selectedVendor={selectedVendor}
            setSelectedVendor={setSelectedVendor}
            vendors={vendors}
            showVendorPicker={showVendorPicker}
            setShowVendorPicker={setShowVendorPicker}
            showTypePicker={showTypePicker}
            setShowTypePicker={setShowTypePicker}
            onSubmit={handleSubmit}
            isSubmitting={submitMutation.isPending}
            submitError={submitMutation.error?.message ?? null}
          />
        )}
      </ScrollView>

      <VendorPickerModal
        visible={showVendorPicker}
        vendors={vendors}
        selected={selectedVendor}
        onSelect={(v) => { setSelectedVendor(v); setShowVendorPicker(false); }}
        onClose={() => setShowVendorPicker(false)}
      />

      <TypePickerModal
        visible={showTypePicker}
        selected={form.violation_type}
        onSelect={(t) => { setForm((f) => ({ ...f, violation_type: t })); setShowTypePicker(false); }}
        onClose={() => setShowTypePicker(false)}
      />
    </View>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ["capture", "analyzing", "review", "vendor"];
  const labels = ["Photo", "Analyze", "Review", "Assign"];
  const idx = steps.indexOf(current);
  return (
    <View style={styles.stepWrap}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <View style={styles.stepItem}>
            <View style={[styles.stepDot, i <= idx && styles.stepDotActive]}>
              {i < idx
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[styles.stepNum, i === idx && styles.stepNumActive]}>{i + 1}</Text>
              }
            </View>
            <Text style={[styles.stepLabel, i === idx && styles.stepLabelActive]}>{labels[i]}</Text>
          </View>
          {i < steps.length - 1 && (
            <View style={[styles.stepLine, i < idx && styles.stepLineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function CaptureStep({
  imageUri, analyzeError, onCamera, onGallery, onAnalyze, canAnalyze,
}: {
  imageUri: string | null; analyzeError: string | null;
  onCamera(): void; onGallery(): void; onAnalyze(): void; canAnalyze: boolean;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Step 1 — Capture Violation Photo</Text>
      <Text style={styles.sectionSub}>
        Take or upload a photo. The AI agent will analyze it and fill in the violation notice automatically.
      </Text>

      {imageUri ? (
        <View style={styles.imagePreviewWrap}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          <View style={styles.imageActions}>
            <TouchableOpacity style={styles.imageActionBtn} onPress={onCamera}>
              <Ionicons name="camera-outline" size={16} color={Colors.navy} />
              <Text style={styles.imageActionText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageActionBtn} onPress={onGallery}>
              <Ionicons name="images-outline" size={16} color={Colors.navy} />
              <Text style={styles.imageActionText}>Replace</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.photoPickerRow}>
          <TouchableOpacity style={styles.photoPickerCard} onPress={onCamera}>
            <Ionicons name="camera" size={36} color={Colors.navy} />
            <Text style={styles.photoPickerLabel}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoPickerCard} onPress={onGallery}>
            <Ionicons name="images" size={36} color={Colors.navy} />
            <Text style={styles.photoPickerLabel}>Choose from Library</Text>
          </TouchableOpacity>
        </View>
      )}

      {analyzeError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={Colors.danger} />
          <Text style={styles.errorBannerText}>{analyzeError}</Text>
        </View>
      )}

      {canAnalyze && (
        <TouchableOpacity style={styles.analyzeBtn} onPress={onAnalyze}>
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={styles.analyzeBtnText}>Analyze with AI Agent</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function AnalyzingStep() {
  return (
    <View style={styles.analyzingWrap}>
      <View style={styles.analyzingCard}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.analyzingTitle}>AI Agent Analyzing...</Text>
        <Text style={styles.analyzingText}>
          Inspecting the photo for HOA violations, assessing severity, and drafting the notice.
        </Text>
        <View style={styles.analyzingSteps}>
          {["Identifying violation type", "Assessing severity", "Drafting notice"].map((s, i) => (
            <View key={i} style={styles.analyzingStep}>
              <Ionicons name="ellipse" size={6} color={Colors.gold} />
              <Text style={styles.analyzingStepText}>{s}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ReviewStep({
  step, setStep, form, setForm, analysis, imageUri,
  selectedVendor, setSelectedVendor, vendors,
  showVendorPicker, setShowVendorPicker,
  showTypePicker, setShowTypePicker,
  onSubmit, isSubmitting, submitError,
}: {
  step: Step; setStep(s: Step): void;
  form: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  analysis: Analysis; imageUri: string | null;
  selectedVendor: Vendor | null; setSelectedVendor(v: Vendor | null): void;
  vendors: Vendor[];
  showVendorPicker: boolean; setShowVendorPicker(v: boolean): void;
  showTypePicker: boolean; setShowTypePicker(v: boolean): void;
  onSubmit(): void; isSubmitting: boolean; submitError: string | null;
}) {
  const upd = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <View>
      <View style={styles.analysisBanner}>
        <View style={[styles.severityBadge, { backgroundColor: severityColor(analysis.severity) }]}>
          <Text style={styles.severityText}>{analysis.severity.toUpperCase()}</Text>
        </View>
        <Text style={styles.analysisSummary}>{analysis.summary}</Text>
      </View>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.thumbImg} resizeMode="cover" />
      )}

      <Text style={styles.sectionTitle}>Step 2 — Review Notice Details</Text>
      <Text style={styles.sectionSub}>The AI has pre-filled the form. Edit any field as needed.</Text>

      <Label text="Resident Name *" />
      <TextInput style={styles.input} value={form.resident_name} onChangeText={(v) => upd("resident_name", v)} placeholder="e.g. John Smith" placeholderTextColor={Colors.muted} />

      <Label text="Unit *" />
      <TextInput style={styles.input} value={form.unit} onChangeText={(v) => upd("unit", v)} placeholder="e.g. 42A" placeholderTextColor={Colors.muted} />

      <Label text="Violation Type *" />
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTypePicker(true)}>
        <Text style={styles.pickerBtnText}>{form.violation_type}</Text>
        <Ionicons name="chevron-down" size={16} color={Colors.muted} />
      </TouchableOpacity>

      <Label text="Incident Date *" />
      <TextInput style={styles.input} value={form.incident_date} onChangeText={(v) => upd("incident_date", v)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.muted} />

      <Label text="Description *" />
      <TextInput
        style={[styles.input, styles.textArea]}
        value={form.description}
        onChangeText={(v) => upd("description", v)}
        multiline numberOfLines={4}
        placeholder="Describe the violation..."
        placeholderTextColor={Colors.muted}
        textAlignVertical="top"
      />

      <Label text="Required Action *" />
      <TextInput
        style={[styles.input, styles.textArea]}
        value={form.required_action}
        onChangeText={(v) => upd("required_action", v)}
        multiline numberOfLines={3}
        placeholder="Action required from resident..."
        placeholderTextColor={Colors.muted}
        textAlignVertical="top"
      />

      <View style={styles.rowFields}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Label text="Compliance Deadline" />
          <TextInput style={styles.input} value={form.compliance_deadline} onChangeText={(v) => upd("compliance_deadline", v)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Label text="Fine ($)" />
          <TextInput style={styles.input} value={form.fine_amount} onChangeText={(v) => upd("fine_amount", v)} keyboardType="numeric" placeholder="0.00" placeholderTextColor={Colors.muted} />
        </View>
      </View>

      <Label text="Issued By" />
      <TextInput style={styles.input} value={form.issued_by} onChangeText={(v) => upd("issued_by", v)} placeholder="Board member name" placeholderTextColor={Colors.muted} />

      <Text style={styles.sectionTitle}>Step 3 — Assign to Vendor</Text>
      <Text style={styles.sectionSub}>Assign this violation to a vendor for remediation follow-up.</Text>

      <TouchableOpacity
        style={[styles.vendorCard, selectedVendor ? styles.vendorCardSelected : undefined]}
        onPress={() => setShowVendorPicker(true)}
      >
        {selectedVendor ? (
          <View style={styles.vendorCardInner}>
            <View style={styles.vendorIcon}>
              <Ionicons name="business" size={20} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vendorName}>{selectedVendor.name}</Text>
              <Text style={styles.vendorSpecialty}>{selectedVendor.specialty}</Text>
              {selectedVendor.phone && <Text style={styles.vendorContact}>{selectedVendor.phone}</Text>}
            </View>
            <View style={styles.suggestedBadge}>
              <Ionicons name="sparkles" size={11} color={Colors.gold} />
              <Text style={styles.suggestedText}>AI Match</Text>
            </View>
          </View>
        ) : (
          <View style={styles.vendorCardInner}>
            <Ionicons name="person-add-outline" size={22} color={Colors.muted} />
            <Text style={styles.vendorPlaceholder}>Tap to assign a vendor</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
      </TouchableOpacity>

      {selectedVendor && (
        <TouchableOpacity style={styles.clearVendorBtn} onPress={() => setSelectedVendor(null)}>
          <Text style={styles.clearVendorText}>Remove vendor assignment</Text>
        </TouchableOpacity>
      )}

      {submitError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={Colors.danger} />
          <Text style={styles.errorBannerText}>Failed to submit: {submitError}</Text>
        </View>
      )}

      <View style={styles.formCheck}>
        {!form.resident_name && <CheckRow label="Resident name is required" ok={false} />}
        {!form.unit && <CheckRow label="Unit number is required" ok={false} />}
        {!form.description && <CheckRow label="Description is required" ok={false} />}
        {!form.required_action && <CheckRow label="Required action is required" ok={false} />}
        {form.resident_name && form.unit && form.description && form.required_action && (
          <CheckRow label="All required fields filled" ok={true} />
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.submitBtn,
          (!form.resident_name || !form.unit || !form.description || !form.required_action || isSubmitting)
            && styles.submitBtnDisabled,
        ]}
        onPress={onSubmit}
        disabled={!form.resident_name || !form.unit || !form.description || !form.required_action || isSubmitting}
      >
        {isSubmitting
          ? <ActivityIndicator size="small" color="#fff" />
          : (
            <>
              <Ionicons name="paper-plane" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>File Violation Notice</Text>
            </>
          )}
      </TouchableOpacity>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={styles.checkRow}>
      <Ionicons name={ok ? "checkmark-circle" : "close-circle"} size={15} color={ok ? Colors.success : Colors.danger} />
      <Text style={[styles.checkText, { color: ok ? Colors.success : Colors.danger }]}>{label}</Text>
    </View>
  );
}

function VendorPickerModal({
  visible, vendors, selected, onSelect, onClose,
}: {
  visible: boolean; vendors: Vendor[]; selected: Vendor | null;
  onSelect(v: Vendor): void; onClose(): void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>Select Vendor</Text>
        <ScrollView>
          {vendors.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.vendorRow, selected?.id === v.id && styles.vendorRowSelected]}
              onPress={() => onSelect(v)}
            >
              <View style={styles.vendorRowIcon}>
                <Ionicons name="business-outline" size={18} color={Colors.navy} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vendorRowName}>{v.name}</Text>
                <Text style={styles.vendorRowSpec}>{v.specialty}</Text>
              </View>
              {selected?.id === v.id && <Ionicons name="checkmark-circle" size={20} color={Colors.gold} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function TypePickerModal({
  visible, selected, onSelect, onClose,
}: {
  visible: boolean; selected: string;
  onSelect(t: string): void; onClose(): void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>Violation Type</Text>
        <ScrollView>
          {VIOLATION_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.vendorRow, selected === t && styles.vendorRowSelected]}
              onPress={() => onSelect(t)}
            >
              <Text style={[styles.vendorRowName, { flex: 1 }]}>{t}</Text>
              {selected === t && <Ionicons name="checkmark-circle" size={20} color={Colors.gold} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20,
    paddingVertical: 14, backgroundColor: Colors.white, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: Colors.navy },
  headerSub: { fontSize: 12, color: Colors.muted },
  agentBadge: {
    marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FEF6E4", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.gold,
  },
  agentBadgeText: { fontSize: 12, fontWeight: "700", color: Colors.gold },
  stepWrap: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 20,
    paddingVertical: 14, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: Colors.navy },
  stepNum: { fontSize: 11, fontWeight: "700", color: Colors.muted },
  stepNumActive: { color: "#fff" },
  stepLabel: { fontSize: 10, color: Colors.muted },
  stepLabelActive: { color: Colors.navy, fontWeight: "600" },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginBottom: 16 },
  stepLineActive: { backgroundColor: Colors.navy },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.navy, marginTop: 16, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: Colors.muted, marginBottom: 16, lineHeight: 18 },
  photoPickerRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  photoPickerCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 24,
    alignItems: "center", gap: 12, borderWidth: 2, borderColor: Colors.border,
    borderStyle: "dashed",
  },
  photoPickerLabel: { fontSize: 13, fontWeight: "600", color: Colors.navy, textAlign: "center" },
  imagePreviewWrap: { borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  imagePreview: { width: "100%", height: 220 },
  imageActions: {
    flexDirection: "row", backgroundColor: "rgba(0,0,0,0.6)", padding: 12, gap: 16,
  },
  imageActionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  imageActionText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  analyzeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.navy, borderRadius: 14, paddingVertical: 16, gap: 10, marginTop: 8,
  },
  analyzeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  analyzingWrap: { flex: 1, alignItems: "center", paddingTop: 60 },
  analyzingCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 32, alignItems: "center",
    gap: 16, width: "100%",
  },
  analyzingTitle: { fontSize: 20, fontWeight: "700", color: Colors.navy },
  analyzingText: { fontSize: 14, color: Colors.muted, textAlign: "center", lineHeight: 20 },
  analyzingSteps: { gap: 8, alignSelf: "stretch" },
  analyzingStep: { flexDirection: "row", alignItems: "center", gap: 10 },
  analyzingStepText: { fontSize: 13, color: Colors.muted },
  analysisBanner: {
    backgroundColor: Colors.navy, borderRadius: 14, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12,
  },
  severityBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  severityText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  analysisSummary: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "600" },
  thumbImg: { width: "100%", height: 140, borderRadius: 12, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "600", color: Colors.navy, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Colors.text,
  },
  textArea: { height: 90, paddingTop: 12 },
  rowFields: { flexDirection: "row" },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerBtnText: { fontSize: 14, color: Colors.text, flex: 1 },
  vendorCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    borderWidth: 2, borderColor: Colors.border, gap: 12, marginTop: 4,
  },
  vendorCardSelected: { borderColor: Colors.gold },
  vendorCardInner: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  vendorIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#FEF6E4", alignItems: "center", justifyContent: "center",
  },
  vendorName: { fontSize: 14, fontWeight: "700", color: Colors.navy },
  vendorSpecialty: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  vendorContact: { fontSize: 12, color: Colors.muted },
  vendorPlaceholder: { fontSize: 14, color: Colors.muted },
  suggestedBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FEF6E4", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  suggestedText: { fontSize: 10, fontWeight: "700", color: Colors.gold },
  clearVendorBtn: { alignItems: "center", marginTop: 8 },
  clearVendorText: { fontSize: 12, color: Colors.danger },
  formCheck: { gap: 6, marginTop: 16, marginBottom: 8 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkText: { fontSize: 13 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.gold, borderRadius: 14, paddingVertical: 16, gap: 10, marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: Colors.navy, fontSize: 16, fontWeight: "700" },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FDF0EF", borderRadius: 10, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: "#FACCC9",
  },
  errorBannerText: { color: Colors.danger, fontSize: 13, flex: 1 },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 16 },
  doneIconCircle: { marginBottom: 8 },
  doneTitle: { fontSize: 28, fontWeight: "800", color: Colors.navy },
  doneSub: { fontSize: 15, color: Colors.muted, textAlign: "center", lineHeight: 22 },
  doneBtn: {
    backgroundColor: Colors.navy, borderRadius: 14, paddingHorizontal: 40,
    paddingVertical: 14, marginTop: 16,
  },
  doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "70%", paddingBottom: 40, paddingTop: 16,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: Colors.navy, textAlign: "center", marginBottom: 12, paddingHorizontal: 20 },
  vendorRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  vendorRowSelected: { backgroundColor: "#FEF6E4" },
  vendorRowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center",
  },
  vendorRowName: { fontSize: 14, fontWeight: "600", color: Colors.text },
  vendorRowSpec: { fontSize: 12, color: Colors.muted },
});
