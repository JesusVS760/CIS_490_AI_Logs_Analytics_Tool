import { openai } from "@/lib/openai";

export const llmService = {
  async generateAnalytics(userInput: string) {
    try {
      const systemPrompt = `
You are an analytics assistant. 
Given user input, output **strictly valid JSON** with structured analytics. 
- Do not include any explanation or extra text.
- Numeric values should be numbers, not strings with $ or commas.
- Keys should be descriptive and consistent.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
      });

      const text: any = response.choices[0].message.content;

      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch (err) {
        console.warn("LLM response is not valid JSON, returning raw string");
        return { raw: text };
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};

export default llmService;
