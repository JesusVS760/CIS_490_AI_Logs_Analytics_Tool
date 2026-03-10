import { Car } from "lucide-react";

const TodaysTrafficCard = () => {
  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Today's Traffic</h2>
          <p className="mt-6 text-4xl font-bold text-slate-900">325</p>
          <p className="mt-2 text-base text-slate-700">AI Tutor users today</p>
        </div>
        <div className="rounded-full bg-white/80 p-3 text-orange-700">
          <Car size={24} />
        </div>
      </div>
    </div>
  );
};

export default TodaysTrafficCard;
