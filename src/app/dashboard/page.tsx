import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>
      <Button>Button</Button>
      <div className="flex items-start gap-2">
        <Button size="sm" variant="outline">
          Extra Small
        </Button>
      </div>
    </main>
  );
}
