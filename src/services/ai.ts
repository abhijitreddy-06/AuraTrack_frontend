import { authenticatedRequest } from "./auth";

export type AiQuestionResult = {
  success: boolean;
  data: {
    answer: string;
    query?: unknown;
    result?: unknown;
  };
};

export const askAiQuestion = async (question: string) => {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Please enter a question for Aura.");
  }

  const result = await authenticatedRequest<AiQuestionResult>("/api/ai", {
    method: "POST",
    body: { question: trimmedQuestion },
  });

  return result.data.answer;
};
