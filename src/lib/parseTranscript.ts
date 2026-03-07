import { ParsedMessage, ParsedSession, ParsedTranscript } from "@/types";

/**
 * Normalizes PDF-extracted text (which strips all newlines) back into the
 * line-based format the parser expects. Uses precise anchors based on the
 * known transcript format so we don't accidentally split inside code blocks.
 */
function normalizePdfText(raw: string): string {
  let t = raw;

  // 1. Course: and Generated: are always on their own lines at the top
  t = t.replace(/(Course:)/g, "\nCourse:");
  t = t.replace(/(Generated:)/g, "\nGenerated:");

  // 2. Separator lines (==== and ----) — always structural, never inside code
  t = t.replace(/\s*(={8,})\s*/g, "\n$1\n");
  t = t.replace(/\s*(-{8,})\s*/g, "\n$1\n");

  // 3. Student: email — email contains @ so safe to anchor on
  t = t.replace(/\s*(Student:\s+[\w.+%-]+@[\w.-]+)/g, "\n$1\n");

  // 4. Assignment: label
  t = t.replace(/\s*(Assignment:\s+\S+)/g, "\n$1\n");

  // 5. Question: block label
  t = t.replace(/\s*(Question:)\s*/g, "\nQuestion:\n");

  // 6. Timestamp + role lines — very specific pattern, safe anchor
  //    [MM/DD/YYYY, HH:MM:SS AM/PM] Student: or AI-Tutor:
  t = t.replace(
    /\s*(\[\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}:\d{2}\s*[AP]M\]\s*(?:Student|AI-Tutor):)/g,
    "\n$1 ",
  );

  // 7. File(s): label — appears right before code block headers
  t = t.replace(/\s*(File\(s\):)\s*/g, "\nFile(s):\n");

  // 8. File headers: --- filename.ext ---
  //    Anchor on the pattern: space---space word(s) with dot space---space
  //    Use a precise pattern to avoid matching --- inside code strings
  t = t.replace(
    /\s*(---\s+[\w.\s]+(\.cpp|\.py|\.java|\.c|\.h|\.js|\.ts)\s*(?:\(.*?\))?\s*---)\s*/gi,
    "\n$1\n",
  );

  // 9. Terminal History: label
  //    Must come AFTER file header replacement so it doesn't get consumed
  t = t.replace(/\s*(Terminal History:)\s*/g, "\nTerminal History:\n");

  // 10. Collapse excess blank lines
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}

export function parseTranscript(raw: string): ParsedTranscript {
  const normalized = normalizePdfText(raw);
  const lines = normalized.split("\n");
  let i = 0;

  // Parse Header
  let courseName = "";
  let generatedAt = "";

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("Course:")) {
      courseName = line.replace("Course:", "").trim();
    } else if (line.startsWith("Generated:")) {
      generatedAt = line.replace("Generated:", "").trim();
    } else if (line.startsWith("Student:") && line.includes("@")) {
      break;
    }
    i++;
  }

  const sessions: ParsedSession[] = [];

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith("Student:") && line.includes("@")) {
      const studentEmail = line.replace("Student:", "").trim();
      i++;

      // Skip blank/separator lines to find Assignment:
      while (i < lines.length && !lines[i].trim().startsWith("Assignment:")) {
        i++;
      }
      const assignmentName =
        lines[i]?.trim().replace("Assignment:", "").trim() ?? "";
      i++;

      const messages: ParsedMessage[] = [];

      while (i < lines.length) {
        const msgLine = lines[i].trim();

        if (msgLine.startsWith("Student:") && msgLine.includes("@")) break;

        const timestampMatch = msgLine.match(
          /^\[(\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2} [AP]M)\]\s+(Student|AI-Tutor):/,
        );

        if (timestampMatch) {
          const timestamp = timestampMatch[1];
          const rawRole = timestampMatch[2];
          const role: "student" | "ai_tutor" =
            rawRole === "Student" ? "student" : "ai_tutor";

          // Content starts after the role prefix on the same line
          const afterRole = msgLine
            .replace(
              /^\[\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2} [AP]M\]\s*(Student|AI-Tutor):\s*/,
              "",
            )
            .trim();
          i++;

          let content = afterRole ? afterRole + "\n" : "";
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

            if (trimmed === "File(s):") {
              inFiles = true;
              inTerminal = false;
              i++;
              continue;
            }

            if (trimmed === "Terminal History:") {
              // Save any open file
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
              const fileHeaderMatch = trimmed.match(/^---\s+(.+?)\s+---$/);
              if (fileHeaderMatch) {
                // Save previous file
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
                currentFileEmpty = fileHeader.toLowerCase().includes("empty");
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

          // Save last open file
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
