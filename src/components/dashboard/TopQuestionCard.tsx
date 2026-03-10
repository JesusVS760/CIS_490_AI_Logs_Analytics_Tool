import { Cloud } from "lucide-react";

const TopQuestionCard = () => {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Top Question</h2>
          <p className="mt-4 text-lg font-medium text-slate-800">
            What does {"<iostream>"} do?
          </p>
          <p className="mt-6 text-sm text-slate-600">Times asked</p>
          <p className="text-4xl font-bold text-slate-900">231</p>
        </div>
        <div className="rounded-full bg-white/80 p-3 text-sky-700">
          <Cloud size={24} />
        </div>
      </div>
    </div>
  );
};

export default TopQuestionCard;
