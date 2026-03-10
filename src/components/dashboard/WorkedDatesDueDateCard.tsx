const WorkedDatesDueDateCard = () => {
  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Most Worked Dates vs Due Date
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Users worked the following times before the following due date:
        </p>
      </div>

      <div className="relative h-[320px] rounded-xl border border-slate-200 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:56px_56px] bg-white p-6">
        <div className="absolute bottom-4 left-6 right-6 flex justify-between text-xs text-slate-500">
          <span>7 days before</span>
          <span>5 days before</span>
          <span>3 days before</span>
          <span>1 day before</span>
          <span>Due date</span>
        </div>
      </div>
    </section>
  );
};

export default WorkedDatesDueDateCard;
