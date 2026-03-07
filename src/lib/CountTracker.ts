import { Message } from "@/types";

const studentPhrases: Array<string> = [
  // Requests for Help
  "can you explain",
  "help me understand",
  "show me how",
  "give solution",
  "give me solution",
  "guide me through",
  "step by step",
  "walk me through",
  "give me an example",
  "demonstrate this problem",
  "break it down for me",
  "explain in detail",
  "check my work",
  "fix it now",
  "full code",
  "explain getline",
  "not sure",

  // Understanding & Confusion
  "i don't understand",
  "i'm confused about",
  "what does this mean",
  "why does this happen",
  "can you clarify",
  "explain it again",
  "not sure how",
  "how do i solve",
  "help me figure out",
  "i'm stuck on",

  // Confirmation & Feedback
  "is this correct",
  "did i do this right",
  "check my answer",
  "am i wrong",
  "validate this solution",
  "confirm my work",
  "review this step",

  // Study & Academic Context
  "for the assignment",
  "for the homework",
  "for the exam",
  "need help with question",
  "working on the project",
  "practice problem",
  "study guide question",
  "preparing for test",
  "help with topic",
  "explain this concept",
];

const phraseFrequency: Record<string, number> = {};

const CountTracker = (msg: Message[]) => {
  msg.forEach((msg) => {
    studentPhrases.forEach((phrase) => {
      if (msg.content.toLowerCase() === phrase) {
        phraseFrequency[phrase] = (phraseFrequency[phrase] || 0) + 1;
      }
    });
  });
  return phraseFrequency;
};

export default CountTracker;
