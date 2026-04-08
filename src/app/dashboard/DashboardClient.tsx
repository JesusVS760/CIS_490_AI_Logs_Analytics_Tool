"use client";

import AnalyticsDashboard from "@/components/dashboard/AnalyticsDashboard";
import TranscriptUpload from "@/components/upload/TranscriptUpload";
import axios from "axios";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useDashboardAssignmentFilter } from "@/components/dashboard/DashboardAssignmentFilterContext";

type AiAnalyticsContextType = {
  isAiAccepted: boolean;
  setIsAiAccepted: (value: boolean) => void;
  pendingUploadSuccess: boolean;
  setPendingUploadSuccess: (value: boolean) => void;
  refreshAnalyticsData: () => Promise<void>;
  sessions: any[];
  messages: any[];
  hasSessions: boolean;
  loadingAnalytics: boolean;
};

export const AiAnalyticsContext = createContext<AiAnalyticsContextType>({
  isAiAccepted: false,
  setIsAiAccepted: () => {},
  pendingUploadSuccess: false,
  setPendingUploadSuccess: () => {},
  refreshAnalyticsData: async () => {},
  sessions: [],
  messages: [],
  hasSessions: false,
  loadingAnalytics: true,
});

export const useAiAnalytics = () => useContext(AiAnalyticsContext);

const getAssignmentLabel = (message: Record<string, unknown>): string | null => {
  const possibleValues = [
    message.assignmentName,
    message.assignmentTitle,
    message.assignment,
    message.title,
    message.taskName,
    (message.assignment as Record<string, unknown> | undefined)?.name,
    (message.session as Record<string, unknown> | undefined)?.assignmentName,
    (
      (message.session as Record<string, unknown> | undefined)?.assignment as
        | Record<string, unknown>
        | undefined
    )?.name,
  ];

  for (const value of possibleValues) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

export default function DashboardPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [isAiAccepted, setIsAiAccepted] = useState<boolean>(false);
  const [pendingUploadSuccess, setPendingUploadSuccess] =
    useState<boolean>(false);

  const { setAssignmentOptions } = useDashboardAssignmentFilter();

  const refreshAnalyticsData = useCallback(async () => {
    try {
      setLoadingAnalytics(true);
      setAssignmentOptions([]);

      const [sessionsResponse, messagesResponse] = await Promise.all([
        axios.get("/api/sessions", {
          withCredentials: true,
          params: { t: Date.now() },
        }),
        axios.get("/api/messages", {
          withCredentials: true,
          params: { t: Date.now() },
        }),
      ]);

      const nextSessions = Array.isArray(sessionsResponse.data)
        ? sessionsResponse.data
        : [];
      const nextMessages = Array.isArray(messagesResponse.data)
        ? messagesResponse.data
        : [];

      setSessions(nextSessions);
      setMessages(nextMessages);
    } catch (error) {
      console.error("failed to refresh analytics data", error);
      setSessions([]);
      setMessages([]);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [setAssignmentOptions]);

  useEffect(() => {
    refreshAnalyticsData();
  }, [refreshAnalyticsData]);

  useEffect(() => {
    if (messages.length === 0) return;

    const options = Array.from(
      new Set(
        messages
          .map((message) =>
            getAssignmentLabel(message as Record<string, unknown>)
          )
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b));

    setAssignmentOptions(options);
  }, [messages, setAssignmentOptions]);

  const hasSessions = sessions.length > 0;

  const contextValue = useMemo(
    () => ({
      isAiAccepted,
      setIsAiAccepted,
      pendingUploadSuccess,
      setPendingUploadSuccess,
      refreshAnalyticsData,
      sessions,
      messages,
      hasSessions,
      loadingAnalytics,
    }),
    [
      isAiAccepted,
      pendingUploadSuccess,
      refreshAnalyticsData,
      sessions,
      messages,
      hasSessions,
      loadingAnalytics,
    ]
  );

  return (
    <AiAnalyticsContext.Provider value={contextValue}>
      <div>
        {loadingAnalytics ? (
          <div className="flex justify-center items-center min-h-screen">
            <div className="text-sm text-muted-foreground">
              Loading dashboard...
            </div>
          </div>
        ) : hasSessions ? (
          <AnalyticsDashboard />
        ) : (
          <div className="flex justify-center items-center min-h-screen">
            <TranscriptUpload />
          </div>
        )}
      </div>
    </AiAnalyticsContext.Provider>
  );
}