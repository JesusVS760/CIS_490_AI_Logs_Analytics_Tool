import config from "@/config";
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export const analyzerPrompt = "output hello world";
