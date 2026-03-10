export interface ParsedMessage {
  role: "student" | "ai_tutor";
  content: string;
  timestamp: string;
  codeFiles: { filename: string; content: string | null; isEmpty: boolean }[];
  terminalContent: string | null;
}

export interface ParsedSession {
  studentEmail: string;
  assignmentName: string;
  dueDate: string | undefined;
  messages: ParsedMessage[];
}

export interface ParsedTranscript {
  courseName: string;
  generatedAt: string;
  sessions: ParsedSession[];
}

export type Message = {
  content: string;
  role?: "student" | "ai_tutor";
  timestamp?: string;
};
