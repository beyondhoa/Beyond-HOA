import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const SUGGESTIONS = [
  "What changes need board approval?",
  "Can I have a dog over 25 lbs?",
  "How are special assessments approved?",
  "What are the guest parking rules?",
  "How do I request an architectural review?",
  "When does the board need to hold a vote?",
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.avatarBot}>
          <MaterialCommunityIcons name="shield-star" size={14} color={Colors.gold} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.bubbleRow}>
      <View style={styles.avatarBot}>
        <MaterialCommunityIcons name="shield-star" size={14} color={Colors.gold} />
      </View>
      <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
        <ActivityIndicator size="small" color={Colors.navy} />
      </View>
    </View>
  );
}

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const streamingIdRef = useRef<string | null>(null);

  const addMessage = useCallback((role: "user" | "assistant", content: string): string => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setMessages((prev) => [...prev, { id, role, content, timestamp: Date.now() }]);
    return id;
  }, []);

  const updateStreamingMessage = useCallback((id: string, content: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content } : m))
    );
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");

    addMessage("user", trimmed);
    setIsStreaming(true);

    const assistantId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    streamingIdRef.current = assistantId;
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: Date.now() }]);

    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/bylaw-chat", baseUrl);

      const currentMessages = [...messages, { role: "user", content: trimmed }].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: currentMessages }),
      });

      if (!response.ok) throw new Error("Request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              fullContent += data.content;
              updateStreamingMessage(assistantId, fullContent);
            }
            if (data.done) break;
            if (data.error) throw new Error(data.error);
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }
    } catch (err) {
      updateStreamingMessage(assistantId, "I'm sorry, I encountered an issue. Please try again.");
    } finally {
      setIsStreaming(false);
      streamingIdRef.current = null;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [isStreaming, messages, addMessage, updateStreamingMessage]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const showWelcome = messages.length === 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="shield-star" size={20} color={Colors.gold} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Bylaw Advisor</Text>
            <Text style={styles.headerSub}>Powered by Replit AI</Text>
          </View>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setMessages([]); }}
            style={styles.clearBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color={Colors.slate} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {showWelcome ? (
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeIcon}>
              <MaterialCommunityIcons name="shield-star" size={40} color={Colors.gold} />
            </View>
            <Text style={styles.welcomeTitle}>HOA Bylaw Assistant</Text>
            <Text style={styles.welcomeSubtitle}>
              Ask me anything about your HOA rules, architectural guidelines, dues, or community policies.
            </Text>
            <View style={styles.suggestionsGrid}>
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => sendMessage(s)} activeOpacity={0.75}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={isStreaming && messages[messages.length - 1]?.content === "" ? <TypingIndicator /> : null}
          />
        )}

        <View style={[styles.inputContainer, { paddingBottom: bottomPadding + 8 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about bylaws, rules, dues..."
            placeholderTextColor={Colors.slate}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isStreaming) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            activeOpacity={0.8}
          >
            {isStreaming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: Colors.navy,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(201,168,76,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.3)",
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff" },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 16, color: Colors.cream },
  clearBtn: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
  },
  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(201,168,76,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.25)",
    marginBottom: 20,
  },
  welcomeTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    marginBottom: 10,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
    marginBottom: 32,
  },
  suggestionsGrid: { gap: 8, width: "100%" },
  suggestionChip: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  suggestionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
    gap: 12,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 4,
  },
  bubbleRowUser: {
    flexDirection: "row-reverse",
  },
  avatarBot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(201,168,76,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.2)",
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    padding: 14,
  },
  bubbleUser: {
    backgroundColor: Colors.navy,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  typingBubble: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  bubbleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: "#fff",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: Colors.slate,
    opacity: 0.5,
  },
});
