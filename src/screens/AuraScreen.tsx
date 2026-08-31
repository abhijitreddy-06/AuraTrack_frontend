import React, { useRef, useState } from "react";
import {
  Animated,
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
import { useTheme } from "../hooks/useTheme";
import { FloatingNav } from "../components/navigation/FloatingNav";
import { spacing } from "../theme/spacing";
import { typography } from "../theme/typography";

const SUGGESTIONS = [
  "Spending this month",
  "Balance summary",
  "Who owes me money?",
  "Biggest expenses",
];

export const AuraScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const entrance = useRef(new Animated.Value(0)).current;
  const isChatting = messages.length > 0;

  React.useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const askAura = (text: string) => {
    const trimmedQuestion = text.trim();
    if (!trimmedQuestion) return;
    setMessages((currentMessages) => [...currentMessages, trimmedQuestion]);
    setQuestion("");
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
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
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

            {!isChatting ? (
              <>
                <Text style={[styles.greeting, { color: colors.textPrimary }]}>
                  Good afternoon, Abhi 👋
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
                    A clearer view of your money.
                  </Text>
                  <Text
                    style={[styles.cardCopy, { color: colors.textSecondary }]}
                  >
                    Ask Aura about your spending, balances, and money you have
                    lent or borrowed.
                  </Text>
                </View>
                <Text
                  style={[styles.sectionTitle, { color: colors.textSecondary }]}
                >
                  Try asking
                </Text>
                <View style={styles.suggestionGrid}>
                  {SUGGESTIONS.map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      onPress={() => askAura(suggestion)}
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
                        {suggestion}
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
                {messages.map((message, index) => (
                  <View
                    key={`${message}-${index}`}
                    style={[
                      styles.message,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text style={styles.messageText}>{message}</Text>
                  </View>
                ))}
                <Text style={[styles.reply, { color: colors.textSecondary }]}>
                  Aura will connect to your financial data here.
                </Text>
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
            value={question}
            onChangeText={setQuestion}
            onSubmitEditing={() => askAura(question)}
            placeholder="Ask Aura anything..."
            placeholderTextColor={colors.textSecondary}
            returnKeyType="send"
            style={[styles.input, { color: colors.textPrimary }]}
          />
          <Pressable
            accessibilityLabel="Send question"
            onPress={() => askAura(question)}
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <FloatingNav activeTab="aura" onTabPress={() => undefined} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.md },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: { fontFamily: typography.family, fontSize: 30, fontWeight: "700" },
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
  welcomeCard: { borderRadius: 12, marginTop: spacing.lg, padding: spacing.xl },
  cardSpark: { fontSize: 26, marginBottom: spacing.md },
  cardTitle: { fontFamily: typography.family, fontSize: 20, fontWeight: "700" },
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
  suggestionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
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
  chatList: { minHeight: 300 },
  message: {
    alignSelf: "flex-end",
    borderRadius: 12,
    marginBottom: spacing.md,
    maxWidth: "88%",
    padding: spacing.md,
  },
  messageText: {
    color: "#FFFFFF",
    fontFamily: typography.family,
    fontSize: 14,
  },
  reply: {
    fontFamily: typography.family,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
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
