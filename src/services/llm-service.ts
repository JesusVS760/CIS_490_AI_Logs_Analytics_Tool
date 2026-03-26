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
      console.log("RAW LLM TEXT:", text);

      if (!text) {
        console.log("error");
        return;
      }
      const cleaned = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      try {
        return JSON.parse(cleaned);
      } catch (e) {
        console.error("Bad LLM output:", text);
        return {}; // fallback
      }
    } catch (error) {
      console.error("LLM error:", error);
      throw error;
    }
  },
};

export default llmService;
