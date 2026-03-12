"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Message } from "@/types";

type StudentData = {
  studentKey: string;
  studentLabel: string;
  totalMessages: number;
  conversations: {
    conversationKey: string;
    conversationLabel: string;
    count: number;
  }[];
};

const getStudentKey = (message: Message): string | null => {
  const msg = message as Record<string, unknown>;

  const possibleIds = [
    msg.studentId,
    msg.userId,
    msg.email,
    msg.username,
    msg.userName,
    msg.senderId,
    msg.senderEmail,
    msg.studentEmail,
    msg.studentName,
  ];

  for (const value of possibleIds) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim().toLowerCase();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
};

const getStudentLabel = (message: Message, fallbackKey: string): string => {
  const msg = message as Record<string, unknown>;

  const possibleLabels = [
    msg.studentName,
    msg.userName,
    msg.username,
    msg.email,
    msg.studentEmail,
    msg.senderEmail,
  ];

  for (const value of possibleLabels) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return fallbackKey;
};

const getConversationKey = (
  message: Message
): { key: string; label: string } | null => {
  const msg = message as Record<string, unknown>;

  const possibleConversationIds = [
    msg.conversationId,
    msg.conversationID,
    msg.threadId,
    msg.threadID,
    msg.chatId,
    msg.chatID,
    msg.sessionId,
    msg.sessionID,
    msg.conversation,
    msg.thread,
  ];

  for (const value of possibleConversationIds) {
    if (typeof value === "string" && value.trim() !== "") {
      const cleaned = value.trim();
      return { key: cleaned.toLowerCase(), label: cleaned };
    }
    if (typeof value === "number") {
      const str = String(value);
      return { key: str, label: str };
    }
  }

  return null;
};

const buildStudentData = (messages: Message[]): StudentData[] => {
  const studentMap = new Map<
    string,
    {
      label: string;
      conversations: Map<string, { label: string; count: number }>;
    }
  >();

  for (const message of messages) {
    const studentKey = getStudentKey(message);
    const conversationInfo = getConversationKey(message);

    if (!studentKey || !conversationInfo) continue;

    if (!studentMap.has(studentKey)) {
      studentMap.set(studentKey, {
        label: getStudentLabel(message, studentKey),
        conversations: new Map(),
      });
    }

    const studentEntry = studentMap.get(studentKey)!;

    if (!studentEntry.conversations.has(conversationInfo.key)) {
      studentEntry.conversations.set(conversationInfo.key, {
        label: conversationInfo.label,
        count: 0,
      });
    }

    studentEntry.conversations.get(conversationInfo.key)!.count += 1;
  }

  return Array.from(studentMap.entries())
    .map(([studentKey, data]) => {
      const conversations = Array.from(data.conversations.entries())
        .map(([conversationKey, convo]) => ({
          conversationKey,
          conversationLabel: convo.label,
          count: convo.count,
        }))
        .sort((a, b) => b.count - a.count);

      const totalMessages = conversations.reduce((sum, c) => sum + c.count, 0);

      return {
        studentKey,
        studentLabel: data.label,
        totalMessages,
        conversations,
      };
    })
    .sort((a, b) => b.totalMessages - a.totalMessages);
};

const MessagesPerConversation = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedStudentKey, setSelectedStudentKey] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/messages");
        if (!res.ok) throw new Error("Failed to fetch messages");
        const data = await res.json();
        setMessages(data);
      } catch (err) {
        setError("Could not load messages");
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, []);

  const studentData = useMemo(() => buildStudentData(messages), [messages]);

  const selectedStudent =
    selectedStudentKey === "all"
      ? null
      : studentData.find((s) => s.studentKey === selectedStudentKey) ?? null;

  const rows = selectedStudent
    ? selectedStudent.conversations.map((c) => ({
        key: c.conversationKey,
        label: c.conversationLabel,
        value: c.count,
      }))
    : studentData.map((s) => ({
        key: s.studentKey,
        label: s.studentLabel,
        value: s.totalMessages,
      }));

  const maxValue = Math.max(1, ...rows.map((r) => r.value));
  const topRow = rows[0];

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-900">
      <h2 className="text-xl font-semibold mb-4">
        Messages per conversation for each student
      </h2>

      {loading && <p>Loading messages...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Total Messages: {messages.length}
          </p>

          <div className="mb-6 rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">
              {selectedStudent ? "Top Conversation" : "Top Student"}
            </p>
            <p className="text-lg font-semibold">
              {topRow?.label ?? "No data found"}
            </p>
            <p className="text-3xl font-bold">{topRow?.value ?? 0}</p>
          </div>

          <div className="space-y-3">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No log data found.
              </p>
            ) : (
              rows.slice(0, 8).map((row) => {
                const widthPct = Math.round(
                  (row.value / maxValue) * 100
                );

                return (
                  <div key={row.key} className="rounded-lg border px-4 py-3">
                    <div className="mb-2 flex justify-between">
                      <span className="text-sm">{row.label}</span>
                      <span className="font-semibold">{row.value}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-200">
                      <div
                        className="h-2 rounded-full bg-black"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MessagesPerConversation;