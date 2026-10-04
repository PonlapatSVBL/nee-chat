import { Card, CardContent } from '@/presentation/components/ui/card';

export function StatCard({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-none">
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div>{children}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
