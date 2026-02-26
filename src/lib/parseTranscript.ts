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

export function parseTranscript(raw: string): ParsedTranscript {
  const lines = raw.split("\n");
  let i = 0;

  //Parse Header
  let courseName = "";
  let generatedAt = "";

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("Course:")) {
      courseName = line.replace("Course:", "").trim();
    } else if (line.startsWith("Generated:")) {
      generatedAt = line.replace("Generated:", "").trim();
    } else if (line.includes("Student:") && line.includes("@")) {
      break; // reached first student block
    }
    i++;
  }

  // Parse Student/Session Blocks
  const sessions: ParsedSession[] = [];

  while (i < lines.length) {
    const line = lines[i].trim();

    // Detect start of a new student block
    if (line.startsWith("Student:") && line.includes("@")) {
      const studentEmail = line.replace("Student:", "").trim();
      i++;

      const assignmentLine = lines[i]?.trim() ?? "";
      const assignmentName = assignmentLine.replace("Assignment:", "").trim();
      i++;

      // Parse Messages
      const messages: ParsedMessage[] = [];

      while (i < lines.length) {
        const msgLine = lines[i].trim();

        // Stop if we hit a new student block
        if (msgLine.startsWith("Student:") && msgLine.includes("@")) break;

        // Detect a message timestamp line: [MM/DD/YYYY, HH:MM:SS AM/PM]
        const timestampMatch = msgLine.match(
          /^\[(\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2} [AP]M)\]\s+(Student|AI-Tutor):/
        );

        if (timestampMatch) {
          const timestamp = timestampMatch[1];
          const rawRole = timestampMatch[2];
          const role: "student" | "ai_tutor" =
            rawRole === "Student" ? "student" : "ai_tutor";
          i++;

          // Collect message content
          let content = "";
          const codeFiles: ParsedMessage["codeFiles"] = [];
          let terminalContent: string | null = null;
          let inFiles = false;
          let inTerminal = false;
          let currentFileContent = "";
          let currentFilename = "";
          let currentFileEmpty = false;

          while (i < lines.length) {
            const bodyLine = lines[i];
            const trimmed = bodyLine.trim();

            // Stop at next timestamp
            if (
              trimmed.match(/^\[\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2} [AP]M\]/)
            )
              break;

            // Stop at next student block
            if (trimmed.startsWith("Student:") && trimmed.includes("@")) break;

            // Detect File(s) section
            if (trimmed === "File(s):") {
              inFiles = true;
              inTerminal = false;
              i++;
              continue;
            }

            // Detect Terminal History section
            if (trimmed === "Terminal History:") {
              // Save any open file first
              if (currentFilename) {
                codeFiles.push({
                  filename: currentFilename,
                  content: currentFileEmpty ? null : currentFileContent.trim(),
                  isEmpty: currentFileEmpty,
                });
                currentFilename = "";
                currentFileContent = "";
                currentFileEmpty = false;
              }
              inFiles = false;
              inTerminal = true;
              terminalContent = "";
              i++;
              continue;
            }

            if (inFiles) {
              // Detect file header: --- filename.cpp --- or --- filename.cpp (empty...) ---
              const fileHeaderMatch = trimmed.match(/^---\s+(.+?)\s+---$/);
              if (fileHeaderMatch) {
                // Save previous file if any
                if (currentFilename) {
                  codeFiles.push({
                    filename: currentFilename,
                    content: currentFileEmpty
                      ? null
                      : currentFileContent.trim(),
                    isEmpty: currentFileEmpty,
                  });
                }
                const fileHeader = fileHeaderMatch[1];
                currentFileEmpty = fileHeader.includes("empty");
                currentFilename = fileHeader.split("(")[0].trim();
                currentFileContent = "";
              } else {
                currentFileContent += bodyLine + "\n";
              }
            } else if (inTerminal) {
              terminalContent += bodyLine + "\n";
            } else {
              content += bodyLine + "\n";
            }

            i++;
          }

          // Save any remaining open file
          if (currentFilename) {
            codeFiles.push({
              filename: currentFilename,
              content: currentFileEmpty ? null : currentFileContent.trim(),
              isEmpty: currentFileEmpty,
            });
          }

          messages.push({
            role,
            content: content.trim(),
            timestamp,
            codeFiles,
            terminalContent: terminalContent?.trim() ?? null,
          });
        } else {
          i++;
        }
      }

      sessions.push({ studentEmail, assignmentName, messages });
    } else {
      i++;
    }
  }

  return { courseName, generatedAt, sessions };
}
