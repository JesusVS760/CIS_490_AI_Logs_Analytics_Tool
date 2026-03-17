import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const analyzerPrompt = `
You are an analytics assistant. 
Take the user input and produce structured analytics in JSON format.
Do not add extra commentary.
`;
