import { Message } from "@/types";

const studentPhrases: Array<string> = [
  // --- Understanding & confusion ---
  "i'm confused",
  "i am confused",
  "i'm lost",
  "i don't understand",
  "i do not understand",
  "don't get it",
  "makes no sense",
  "not sure how",
  "not sure why",
  "can you explain",
  "can you clarify",
  "what does this mean",
  "how does this work",
  "why does this happen",
  "explain this to me",
  "help me understand",
  "walk me through",
  "step by step",
  "break it down",

  // --- Stuck / need help ---
  "i'm stuck",
  "stuck on this",
  "need help",
  "can you help me",
  "where do i start",
  "how do i start",
  "don't know how",
  "i have no idea",
  "what should i do",
  "how do i fix",
  "how do i solve",
  "help me figure out",

  // --- Validation / checking ---
  "check my code",
  "check my work",
  "is this correct",
  "is this right",
  "did i do this right",
  "am i on the right track",
  "review my code",
  "is my logic correct",
  "does this look right",
  "what am i doing wrong",
  "why is my output wrong",
  "not getting the right output",
  "expected output",

  // --- Code requests ---
  "fix my code",
  "fix this error",
  "full code",
  "complete code",
  "working code",
  "show me the code",
  "write the code",
  "give me an example",
  "show an example",
  "code example",
  "can you debug",
  "help me debug",

  // --- Errors ---
  "getting an error",
  "error in my code",
  "how do i fix this error",
  "why is there an error",
  "getting an error message",
  "why is my code not working",
  "why won't my code run",
  "segmentation fault",
  "infinite loop",
  "memory leak",
  "null pointer",
  "why won't it compile",
  "why is it crashing",
  "why does it crash",
  "not compiling",

  // --- Comparison / choice ---
  "what is the difference between",
  "how is this different from",
  "when should i use",
  "which one should i use",
  "why would i use",
  "when do i use",
  "which is better",
  "what is better",

  // --- Academic context ---
  "for my homework",
  "for my assignment",
  "for my exam",
  "for my project",
  "for my lab",
  "on my test",
  "practice problem",
  "study for exam",
  "exam question",
  "homework question",
  "quiz question",
  "working on project",
  "preparing for test",

  // --- Concept understanding ---
  "what is a pointer",
  "what is a reference",
  "what is a class",
  "what is a function",
  "what is recursion",
  "what is a constructor",
  "what is inheritance",
  "what is polymorphism",
  "what is a vector",
  "what is a linked list",
  "what is dynamic memory",
  "how does recursion work",
  "how does inheritance work",
  "how does a pointer work",

  // --- Logic & approach ---
  "how do i approach",
  "what is the logic",
  "explain the algorithm",
  "how do i implement",
  "best way to",
  "most efficient way",
  "time complexity",
  "space complexity",
  "optimize my code",
  "better approach",
  "which algorithm",
  "how to implement",

  // --- Memory & pointers ---
  "pass by value",
  "pass by reference",
  "dynamic memory",
  "memory allocation",
  "dangling pointer",
  "how to use pointers",
  "pointer arithmetic",

  // --- OOP ---
  "how to use inheritance",
  "how to use templates",
  "virtual function",
  "abstract class",
  "overload a function",
  "override a method",
  "how to create a class",
  "how to use constructors",
  "access specifiers",

  // --- STL / I/O ---
  "how to use vectors",
  "how to use getline",
  "file input output",
  "how to read a file",
  "how to write to file",
  "exception handling",
  "try catch block",
  "how to use cin",
  "how to use cout",
];

export function countTracker(messages: Message[]) {
  const phraseFrequency: Record<string, number> = {};

  messages.forEach((msg) => {
    const content = msg.content.toLowerCase().replace(/[^\w\s]/g, "");

    studentPhrases.forEach((phrase) => {
      if (content.includes(phrase.toLowerCase())) {
        const key = phrase.replace(/\b\w/g, (c) => c.toUpperCase());
        phraseFrequency[key] = (phraseFrequency[key] || 0) + 1;
      }
    });
  });

  return phraseFrequency;
}
