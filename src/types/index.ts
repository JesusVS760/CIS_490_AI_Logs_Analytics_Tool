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
  messages: ParsedMessage[];
}

export interface ParsedTranscript {
  courseName: string;
  generatedAt: string;
  sessions: ParsedSession[];
}

export type SessionMessage = {
  id: string;
  content: string;
  role?: "student" | "ai_tutor";
  timestamp?: string;
};
export type Message = {
  id: string;
  content: string;
  role?: "student" | "ai_tutor";
  timestamp?: string;
  sessionId: number;
  assignmentId: number;
  assignmentName: string;
  assignmentDueDate: string;
  assignmentStartDate: string;
  studentId: number;
  workedDate: string;
};

// COME BACK TO

export type Session = {
  id: number;
  student_id: number;
  assignment_id: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  messages: { role: string; timestamp: string; content?: string }[];
};

export type Sessions = {
  assignmentDueDate: string;
  assignmentId: number;
  assignmentName: string;
  assignmentStartDate: string;
  createdAt: string;
  endedAt: string | null;
  messages: Message[];
};
