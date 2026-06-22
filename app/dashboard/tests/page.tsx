"use client";

import {
  Activity,
  BarChart3,
  FlaskConical,
  PauseCircle,
  PlayCircle,
  TrendingUp,
} from "lucide-react";

type Variant = {
  name: string;
  impressions: number;
  conversions: number;
};

type ABTest = {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused";
  variants: Variant[];
};

const mockTests: ABTest[] = [
  {
    id: "checkout-cta-color",
    name: "checkout-cta-color",
    description: "Testing button color on checkout",
    status: "active",
    variants: [
      { name: "control", impressions: 4520, conversions: 340 },
      { name: "variant", impressions: 4480, conversions: 410 },
    ],
  },
  {
    id: "pricing-display",
    name: "pricing-display",
    description: "Testing pricing display format",
    status: "active",
    variants: [
      { name: "control", impressions: 3200, conversions: 210 },
      { name: "variant", impressions: 3150, conversions: 195 },
    ],
  },
  {
    id: "search-layout",
    name: "search-layout",
    description: "Testing search result layout",
    status: "paused",
    variants: [
      { name: "control", impressions: 1800, conversions: 95 },
      { name: "variant", impressions: 1760, conversions: 112 },
    ],
  },
];

function getConversionRate(impressions: number, conversions: number): string {
  if (impressions === 0) return "0%";
  return ((conversions / impressions) * 100).toFixed(2) + "%";
}

export default function TestsPage() {
  const totalImpressions = mockTests.reduce(
    (sum, t) => sum + t.variants.reduce((s, v) => s + v.impressions, 0),
    0,
  );
  const totalConversions = mockTests.reduce(
    (sum, t) => sum + t.variants.reduce((s, v) => s + v.conversions, 0),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">A/B Tests</h1>
        <p className="text-sm text-slate-500">
          Manage and monitor your experiment variants.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <FlaskConical className="mx-auto mb-2 h-7 w-7 text-[var(--brand-500)]" />
          <p className="text-xs font-semibold text-slate-500">Active Tests</p>
          <p className="text-2xl font-bold text-slate-900">
            {mockTests.filter((t) => t.status === "active").length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <BarChart3 className="mx-auto mb-2 h-7 w-7 text-[var(--brand-500)]" />
          <p className="text-xs font-semibold text-slate-500">Impressions</p>
          <p className="text-2xl font-bold text-slate-900">
            {totalImpressions.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <TrendingUp className="mx-auto mb-2 h-7 w-7 text-[var(--brand-500)]" />
          <p className="text-xs font-semibold text-slate-500">Conversions</p>
          <p className="text-2xl font-bold text-slate-900">
            {totalConversions.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {mockTests.map((test) => {
          const bestVariant = [...test.variants].sort(
            (a, b) =>
              b.conversions / b.impressions -
              a.conversions / a.impressions,
          )[0];

          return (
            <div
              key={test.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <code className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-mono font-bold text-slate-800">
                      {test.name}
                    </code>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        test.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {test.status === "active" ? (
                        <PlayCircle className="h-3 w-3" />
                      ) : (
                        <PauseCircle className="h-3 w-3" />
                      )}
                      {test.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {test.description}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-2.5">Variant</th>
                      <th className="px-4 py-2.5 text-right">Impressions</th>
                      <th className="px-4 py-2.5 text-right">Conversions</th>
                      <th className="px-4 py-2.5 text-right">Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {test.variants.map((v) => {
                      const isWinner =
                        v.name === bestVariant.name &&
                        test.variants.length > 1;
                      return (
                        <tr
                          key={v.name}
                          className={`transition ${
                            isWinner ? "bg-emerald-50/40" : ""
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-slate-800">
                              {v.name}
                            </span>
                            {isWinner && (
                              <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                <Activity className="h-2.5 w-2.5" />
                                leader
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-700">
                            {v.impressions.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-700">
                            {v.conversions.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-800">
                            {getConversionRate(v.impressions, v.conversions)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
