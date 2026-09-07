import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { FloatingNav } from "../components/navigation/FloatingNav";
import { askAiQuestion } from "../services/ai";
import { isNetworkFailure } from "../services/auth";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const SUGGESTIONS = [
  "How much did I spend this month?",
  "How many times did I eat samosa this month?",
  "How much did I spend in Tirupati?",
  "How much do I owe Ajay?",
  "Who's birthday is next week?",
];

const getFriendlyAiError = (error: unknown) => {
  if (error instanceof Error) {
    const status = (error as Error & { status?: number }).status;
    const message = error.message.toLowerCase();
    if (
      status === 502 ||
      status === 503 ||
      message.includes("provider is unavailable") ||
      message.includes("temporarily unavailable")
    ) {
      return "Aura’s AI service is unavailable. Check the server’s OpenRouter API key and model configuration.";
    }
    if (isNetworkFailure(error) || message.includes("failed to fetch")) {
      return "No internet connection. Please check your connection and try again.";
    }
    if (message.includes("expired") || message.includes("sign in again")) {
      return "Your session has expired. Please sign in again.";
    }
    if (
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      return "You’re asking too quickly. Please wait a minute and try again.";
    }
    if (message.includes("timed out") || message.includes("timeout")) {
      return "Aura took too long to respond. Please try again.";
    }
    if (
      message.includes("unavailable") ||
      message.includes("temporarily unavailable")
    ) {
      return "Aura is temporarily unavailable. Please try again in a moment.";
    }
    if (message.includes("401") || message.includes("unauthorized")) {
      return "Your session has expired. Please sign in again.";
    }
    if (message.includes("429")) {
      return "You’re asking too quickly. Please wait a minute and try again.";
    }
    if (
      message.includes("invalid ai request") ||
      message.includes("request failed")
    ) {
      return "Aura’s AI service could not process this request. Check the server’s OpenRouter configuration and try again.";
    }
  }

  return "Something went wrong while asking Aura. Please try again.";
};

export const AuraScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    const keyboardShow = Keyboard.addListener("keyboardDidShow", () => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 120);
    });

    return () => keyboardShow.remove();
  }, []);

  const isEmpty = messages.length === 0;

  const suggestionRows = useMemo(() => {
    return SUGGESTIONS.map((question) => ({
      key: question,
      label: question,
    }));
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  const askAura = async (text: string) => {
    const trimmedQuestion = text.trim();
    if (!trimmedQuestion || isLoading) return;

    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text: trimmedQuestion },
    ]);
    setDraft("");
    setError(null);
    setIsLoading(true);
    scrollToBottom();

    try {
      const answer = await askAiQuestion(trimmedQuestion);
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", text: answer },
      ]);
    } catch (requestError) {
      const friendly = getFriendlyAiError(requestError);
      setError(friendly);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: friendly,
        },
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        >
          <Animated.View
            style={{
              opacity: entrance,
              transform: [
                {
                  translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            }}
          >
            <View style={styles.headingRow}>
              <View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Aura
                </Text>
                <Text
                  style={[styles.subtitle, { color: colors.textSecondary }]}
                >
                  Your personal financial assistant
                </Text>
              </View>
              <Text style={[styles.headingSpark, { color: colors.primary }]}>
                ✦
              </Text>
            </View>

            {isEmpty ? (
              <>
                <Text style={[styles.greeting, { color: colors.textPrimary }]}>
                  Good afternoon 👋
                </Text>
                <View
                  style={[
                    styles.welcomeCard,
                    { backgroundColor: colors.cardBackground },
                  ]}
                >
                  <Text style={[styles.cardSpark, { color: colors.primary }]}>
                    ✦
                  </Text>
                  <Text
                    style={[styles.cardTitle, { color: colors.textPrimary }]}
                  >
                    Ask Aura about your money.
                  </Text>
                  <Text
                    style={[styles.cardCopy, { color: colors.textSecondary }]}
                  >
                    Get quick answers on spending, balances, debt, habits, and
                    life events without leaving the app.
                  </Text>
                </View>

                <Text
                  style={[styles.sectionTitle, { color: colors.textSecondary }]}
                >
                  Try asking
                </Text>
                <View style={styles.suggestionGrid}>
                  {suggestionRows.map((suggestion) => (
                    <Pressable
                      key={suggestion.key}
                      onPress={() => askAura(suggestion.label)}
                      disabled={isLoading}
                      style={({ pressed }) => [
                        styles.suggestion,
                        { backgroundColor: colors.cardBackground },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.suggestionText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {suggestion.label}
                      </Text>
                      <Text style={[styles.arrow, { color: colors.primary }]}>
                        →
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.chatList}>
                <Text
                  style={[styles.sectionTitle, { color: colors.textSecondary }]}
                >
                  Conversation
                </Text>

                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.messageRow,
                      message.role === "user"
                        ? styles.userRow
                        : styles.assistantRow,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        {
                          backgroundColor:
                            message.role === "user"
                              ? colors.primary
                              : colors.cardBackground,
                          borderColor: colors.divider,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          {
                            color:
                              message.role === "user"
                                ? "#FFFFFF"
                                : colors.textPrimary,
                          },
                        ]}
                      >
                        {message.text}
                      </Text>
                    </View>
                  </View>
                ))}

                {isLoading && (
                  <View style={[styles.loadingRow, styles.assistantRow]}>
                    <View
                      style={[
                        styles.messageBubble,
                        {
                          backgroundColor: colors.cardBackground,
                          borderColor: colors.divider,
                        },
                      ]}
                    >
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  </View>
                )}
              </View>
            )}

            {error && (
              <View
                style={[
                  styles.errorCard,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.divider,
                  },
                ]}
              >
                <Text style={[styles.errorTitle, { color: colors.expense }]}>
                  Unable to answer
                </Text>
                <Text
                  style={[styles.errorText, { color: colors.textSecondary }]}
                >
                  {error}
                </Text>
                <Pressable
                  onPress={() => draft && askAura(draft)}
                  style={[
                    styles.retryButton,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.divider,
            },
          ]}
        >
          <Text style={[styles.inputSpark, { color: colors.primary }]}>✦</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => askAura(draft)}
            placeholder="Ask Aura anything..."
            placeholderTextColor={colors.textSecondary}
            returnKeyType="send"
            multiline={false}
            editable={!isLoading}
            style={[styles.input, { color: colors.textPrimary }]}
          />
          <Pressable
            accessibilityLabel="Send question"
            onPress={() => askAura(draft)}
            disabled={isLoading || !draft.trim()}
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  isLoading || !draft.trim() ? colors.divider : colors.primary,
              },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <FloatingNav
        activeTab="aura"
        onTabPress={(tab) => {
          if (tab === "home") router.replace("/home");
          if (tab === "analytics") router.replace("/analytics");
          if (tab === "settings") router.replace("/settings");
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: typography.family,
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    fontFamily: typography.family,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  headingSpark: { fontSize: 42, fontWeight: "300" },
  greeting: {
    fontFamily: typography.family,
    fontSize: 20,
    fontWeight: "600",
    marginTop: spacing["2xl"],
  },
  welcomeCard: {
    borderRadius: 12,
    marginTop: spacing.lg,
    padding: spacing.xl,
  },
  cardSpark: { fontSize: 26, marginBottom: spacing.md },
  cardTitle: {
    fontFamily: typography.family,
    fontSize: 20,
    fontWeight: "700",
  },
  cardCopy: {
    fontFamily: typography.family,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.family,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing["2xl"],
    textTransform: "uppercase",
  },
  suggestionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  suggestion: {
    borderRadius: 12,
    justifyContent: "space-between",
    minHeight: 90,
    padding: spacing.lg,
    width: "47%",
  },
  pressed: { opacity: 0.7 },
  suggestionText: {
    fontFamily: typography.family,
    fontSize: 14,
    fontWeight: "600",
    maxWidth: "90%",
  },
  arrow: { alignSelf: "flex-end", fontSize: 18 },
  chatList: { paddingTop: spacing.md },
  messageRow: { marginBottom: spacing.md, width: "100%" },
  userRow: { alignItems: "flex-end" },
  assistantRow: { alignItems: "flex-start" },
  loadingRow: { marginBottom: spacing.md },
  messageBubble: {
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: "88%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  messageText: {
    fontFamily: typography.family,
    fontSize: 14,
    lineHeight: 21,
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  errorTitle: {
    fontFamily: typography.family,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  errorText: {
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: "#FFFFFF",
    fontFamily: typography.family,
    fontSize: 13,
    fontWeight: "600",
  },
  inputBar: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    margin: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  inputSpark: { fontSize: 20, marginHorizontal: spacing.sm },
  input: {
    flex: 1,
    fontFamily: typography.family,
    fontSize: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 9,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sendIcon: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
});
