import { MoonStar } from "lucide-react";

const TimeOfDayCard = () => {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Time of Day</h2>
          <p className="mt-6 text-4xl font-bold text-slate-900">11pm</p>
          <p className="mt-2 max-w-xs text-sm text-slate-700">
            This was the time of day users chatted the most.
          </p>
        </div>
        <div className="rounded-full bg-white/80 p-3 text-amber-700">
          <MoonStar size={24} />
        </div>
      </div>
    </div>
  );
};

export default TimeOfDayCard;
