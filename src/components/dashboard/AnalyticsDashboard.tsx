//Way its setup currently, AnalyticsDashboard will upload the log messages and passes
//them to UniqueUsersCard
//Will render AnalyticsDashboard as normally

"use client";

import ChatDuration from "./ChatDuration";
import { WordCloudCard } from "./WordCloud";
import TopQuestionCard from "./TopQuestionCard";
import TodaysTrafficCard from "./TodaysTrafficCard";
import TimeOfDayCard from "./TimeOfDayCard";
import MessagesPerConversation from "./MessagesPerConversation";
import TrafficPerDayCard from "./TrafficPerDayCard";
import UniqueStudentTotalMsgCard from "./UniqueStudentTotalMsgCard";
import { useAiAnalytics } from "@/app/dashboard/page";

const AnalyticsDashboard = () => {
  const { messages, loadingAnalytics, pendingUploadSuccess, hasSessions } =
    useAiAnalytics();

  if (loadingAnalytics) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">
          Loading analytics...
        </div>
      </div>
    );
  }

  if (!hasSessions) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">
          No uploaded session data found yet.
        </div>
      </div>
    );
  }

  return (
    <div
      key={pendingUploadSuccess ? "uploaded" : "default"}
      className="w-full space-y-8 px-4 py-6"
    >
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <div className="flex flex-col gap-3">
          <TopQuestionCard messages={messages} />
          <TodaysTrafficCard messages={messages} />
        </div>

        <div className="flex items-stretch">
          <MessagesPerConversation />
        </div>

        <div className="flex items-stretch">
          <ChatDuration />
        </div>

        <div className="flex items-stretch">
          <WordCloudCard messages={messages} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6">
        <UniqueStudentTotalMsgCard messages={messages} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TrafficPerDayCard />
        <TimeOfDayCard />
      </section>
    </div>
  );
};

export default AnalyticsDashboard;