import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Hash,
  CheckSquare,
  Calendar,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#2563eb",
];

interface CustomFieldAnalyticsProps {
  accountId: number;
}

export function CustomFieldAnalytics({ accountId }: CustomFieldAnalyticsProps) {
  const stableAccountId = useMemo(() => accountId, [accountId]);

  const { data: analytics, isLoading } =
    trpc.customFieldAnalytics.getAnalytics.useQuery(
      { accountId: stableAccountId },
      { enabled: !!stableAccountId }
    );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Custom Field Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-white border-0 card-shadow">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[200px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (
    !analytics ||
    (analytics.dropdowns.length === 0 &&
      analytics.numbers.length === 0 &&
      analytics.checkboxes.length === 0 &&
      analytics.dates.length === 0)
  ) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Custom Field Analytics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analytics.dropdowns.map((dd) => (
          <DropdownCard key={dd.slug} data={dd} />
        ))}
        {analytics.numbers.map((ns) => (
          <NumberCard key={ns.slug} data={ns} />
        ))}
        {analytics.checkboxes.map((cb) => (
          <CheckboxCard key={cb.slug} data={cb} />
        ))}
        {analytics.dates.map((ds) => (
          <DateCard key={ds.slug} data={ds} />
        ))}
      </div>
    </div>
  );
}

// ─── Dropdown Distribution Card ───

function DropdownCard({
  data,
}: {
  data: { name: string; slug: string; values: { label: string; count: number }[]; total: number };
}) {
  const chartData = data.values.map((v) => ({
    value: v.label,
    count: v.count,
    percentage: data.total > 0 ? Math.round((v.count / data.total) * 100) : 0,
  }));

  return (
    <Card className="bg-white border-0 card-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <PieChartIcon className="h-3.5 w-3.5" />
          {data.name}
          <Badge variant="secondary" className="text-[10px] ml-auto">
            dropdown
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No data yet</p>
        ) : chartData.length <= 6 ? (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="value"
                >
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} contacts`, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconSize={8}
                  formatter={(value: string) => <span className="text-[11px]">{value}</span>}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="value"
                  width={80}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + "…" : v)}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} contacts`, "Count"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 text-[11px] text-muted-foreground text-right">
          {data.total} contacts with value
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Number Stats Card ───

function NumberCard({
  data,
}: {
  data: { name: string; slug: string; avg: number; min: number; max: number; sum: number; count: number };
}) {
  const items = [
    { label: "Average", value: data.avg?.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
    { label: "Min", value: data.min?.toLocaleString() },
    { label: "Max", value: data.max?.toLocaleString() },
    { label: "Sum", value: data.sum?.toLocaleString() },
    { label: "Count", value: data.count?.toLocaleString() },
  ];

  return (
    <Card className="bg-white border-0 card-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Hash className="h-3.5 w-3.5" />
          {data.name}
          <Badge variant="secondary" className="text-[10px] ml-auto">
            number
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 py-2">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-lg font-semibold text-foreground">{item.value ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Checkbox Stats Card ───

function CheckboxCard({
  data,
}: {
  data: { name: string; slug: string; trueCount: number; falseCount: number; total: number; percentage: number };
}) {
  const pieData = [
    { name: "Yes", value: data.trueCount, fill: "#22c55e" },
    { name: "No", value: data.falseCount, fill: "#ef4444" },
  ];

  return (
    <Card className="bg-white border-0 card-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CheckSquare className="h-3.5 w-3.5" />
          {data.name}
          <Badge variant="secondary" className="text-[10px] ml-auto">
            checkbox
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[160px] flex items-center gap-4">
          <div className="w-1/2 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value}`, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">Yes: {data.trueCount} ({data.percentage}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm">No: {data.falseCount} ({100 - data.percentage}%)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Date Summary Card ───

function DateCard({
  data,
}: {
  data: { name: string; slug: string; upcoming7d: number; upcoming30d: number; overdue: number; total: number };
}) {
  return (
    <Card className="bg-white border-0 card-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" />
          {data.name}
          <Badge variant="secondary" className="text-[10px] ml-auto">
            date
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="text-center p-3 rounded-lg bg-red-50">
            <p className="text-xl font-semibold text-red-600">{data.overdue}</p>
            <p className="text-[10px] text-red-500 uppercase tracking-wider">Overdue</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-50">
            <p className="text-xl font-semibold text-amber-600">{data.upcoming7d}</p>
            <p className="text-[10px] text-amber-500 uppercase tracking-wider">Next 7 Days</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-50">
            <p className="text-xl font-semibold text-blue-600">{data.upcoming30d}</p>
            <p className="text-[10px] text-blue-500 uppercase tracking-wider">Next 30 Days</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50">
            <p className="text-xl font-semibold text-foreground">{data.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
