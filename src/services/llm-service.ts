import { openai } from "@/lib/openai";

export const llmService = {
  async generateAnalytics(userInput: string, systemPrompt: string) {
    if (!userInput || typeof userInput !== "string") {
      throw new Error("userInput must be a non-empty string");
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
      });

      const text = response.choices[0].message.content;

      if (!text) {
        throw new Error("LLM returned empty response");
      }

      return JSON.parse(text);
    } catch (error) {
      console.error("LLM error:", error);
      throw error;
    }
  },
};

export default llmService;
