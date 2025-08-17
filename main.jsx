import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Info, Upload, Download, RefreshCcw, Settings, HelpCircle } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip as RTooltip, ResponsiveContainer } from "recharts";

// ------------------------------
// 1) DEFAULT MODEL CONFIG
//    This was auto-extracted from your Excel.
//    You can also upload a JSON at runtime to replace it.
// ------------------------------
const DEFAULT_CONFIG = {
  meta: { total_weight: 1 },
  model: {
    "Financial Performance": {
      "Credit Risk": [
        { kpi: "PAR > 30 Days", weight: 0.05, explanation: "Portfolio overdue >30 days; early delinquency risk indicator." },
        { kpi: "Write-off Ratio", weight: 0.03, explanation: "Write-offs / avg. portfolio; loss realization and discipline." },
      ],
      "Market Position": [
        { kpi: "Client Outreach Growth", weight: 0.02, explanation: "YoY growth in borrowers/AUM; franchise momentum." },
        { kpi: "Market Share", weight: 0.03, explanation: "Share of industry GLP; competitive strength and scale." },
      ],
      "Profitability & Sustainability": [
        { kpi: "RoA", weight: 0.04, explanation: "Net profit / avg. assets; profitability per rupee of assets." },
        { kpi: "RoE", weight: 0.05, explanation: "Net profit / avg. equity; shareholder return; growth buffers." },
        { kpi: "OSS", weight: 0.06, explanation: "Operating revenue / operating costs; >=110% indicates self-sufficiency." },
      ],
    },
    "Refinancing & Liquidity": {
      Reputation: [
        { kpi: "Credit Rating History", weight: 0.03, explanation: "External view of credit strength; impacts funding access/cost." },
      ],
      Diversification: [
        { kpi: "Borrowing Source Mix", weight: 0.03, explanation: "Diversity/tenor of liabilities; lowers refinancing/liquidity risk." },
      ],
      "Liquidity Management": [
        { kpi: "Liquidity Coverage Ratio", weight: 0.04, explanation: "High-quality liquid assets vs. 30-day net outflows; resilience." },
      ],
    },
    "Governance & Management": {
      "Board Effectiveness": [
        { kpi: "Board Diversity", weight: 0.01, explanation: "Balanced board composition improves oversight and trust." },
        { kpi: "Meeting Frequency", weight: 0.01, explanation: "Regular board/committee cadence supports governance effectiveness." },
      ],
      "Management Experience": [
        { kpi: "Years in Microfinance", weight: 0.02, explanation: "Institutional experience; process maturity and credit culture." },
        { kpi: "Crisis Management", weight: 0.01, explanation: "Response to shocks; playbooks, decision speed, stakeholder comms." },
      ],
      "Internal Controls": [
        { kpi: "Audit Compliance", weight: 0.02, explanation: "Internal/Statutory audit findings, closure rates, repeat issues." },
      ],
    },
  },
};

// ------------------------------
// 2) UTILITIES
// ------------------------------
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function computeWeighted(model, scores /* { [kpiKey]: 0..5 } */) {
  let total = 0;
  let perDim = {}; // { dim: number }
  let perDimDen = {}; // { dim: sum weights }

  Object.entries(model).forEach(([dim, subs]) => {
    let dimSum = 0;
    let dimW = 0;
    Object.values(subs).forEach((arr) => {
      arr.forEach((item) => {
        const key = makeKey(dim, item);
        const s = clamp(Number(scores[key] ?? 0), 0, 5);
        const w = Number(item.weight || 0);
        dimSum += w * (s / 5);
        dimW += w;
        total += w * (s / 5);
      });
    });
    perDim[dim] = dimSum;
    perDimDen[dim] = dimW || 1;
  });
  return { total, perDim, perDimDen };
}

function makeKey(dim, item) {
  return `${dim}::${item.kpi}`;
}

function gradeFromScore(pct, bands) {
  // bands: [{label:"A", min:85}, ...] sorted descending
  for (const b of bands) {
    if (pct >= b.min) return b.label;
  }
  return bands[bands.length - 1]?.label ?? "N/A";
}

// ------------------------------
// 3) APP
// ------------------------------
export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [scores, setScores] = useState({});
  const [bands, setBands] = useState([
    { label: "A", min: 85 },
    { label: "B", min: 70 },
    { label: "C", min: 55 },
    { label: "D", min: 40 },
    { label: "E", min: 0 },
  ]);
  const [showSettings, setShowSettings] = useState(false);

  const { total, perDim, perDimDen } = useMemo(
    () => computeWeighted(config.model, scores),
    [config, scores]
  );

  const totalPct = useMemo(() => clamp(Number((total * 100).toFixed(2)), 0, 100), [total]);
  const finalGrade = useMemo(() => gradeFromScore(totalPct, bands), [totalPct, bands]);

  const radarData = useMemo(() => {
    return Object.keys(config.model).map((dim) => ({
      dimension: dim,
      score: clamp((perDim[dim] / (perDimDen[dim] || 1)) * 100, 0, 100),
    }));
  }, [config, perDim, perDimDen]);

  const handleScore = (key, val) => {
    setScores((s) => ({ ...s, [key]: clamp(val, 0, 5) }));
  };

  const handleUpload = async (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.model) throw new Error("Invalid config: missing 'model'");
      setConfig(json);
      setScores({});
    } catch (e) {
      alert(`Couldn't load JSON: ${e.message}`);
    }
  };

  const handleDownloadScores = () => {
    const blob = new Blob([JSON.stringify({ scores, totalPct, finalGrade }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mfi_scores.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => setScores({});

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">MFI Credit Grade Calculator</h1>
            <p className="text-sm text-gray-600">Weighted score out of 100 with configurable grade bands.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm cursor-pointer hover:bg-gray-50">
              <Upload className="w-4 h-4" />
              <span className="text-sm">Load Config JSON</span>
              <input type="file" accept="application/json" className="hidden" onChange={handleUpload} />
            </label>
            <button onClick={handleDownloadScores} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm hover:bg-gray-50">
              <Download className="w-4 h-4" />
              <span className="text-sm">Export Scores</span>
            </button>
            <button onClick={() => setShowSettings((v) => !v)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm hover:bg-gray-50">
              <Settings className="w-4 h-4" />
              <span className="text-sm">Bands</span>
            </button>
            <button onClick={handleReset} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm hover:bg-gray-50">
              <RefreshCcw className="w-4 h-4" />
              <span className="text-sm">Reset</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-6">
        {/* Left: Inputs */}
        <section className="md:col-span-2 space-y-4">
          {Object.entries(config.model).map(([dim, subs], i) => (
            <motion.div key={dim} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white rounded-2xl shadow-sm border">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h2 className="font-semibold">{dim}</h2>
                <span className="text-xs text-gray-500">Dim. score: {((perDim[dim] / (perDimDen[dim] || 1)) * 100 || 0).toFixed(1)}%</span>
              </div>
              <div className="p-3 space-y-3">
                {Object.entries(subs).map(([sub, arr]) => (
                  <div key={sub} className="bg-gray-50 rounded-xl p-3 border">
                    <div className="text-sm font-medium mb-2">{sub}</div>
                    <div className="grid md:grid-cols-2 gap-3">
                      {arr.map((item) => {
                        const key = makeKey(dim, item);
                        const value = Number(scores[key] ?? 0);
                        return (
                          <div key={key} className="bg-white rounded-xl border p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold">{item.kpi}</div>
                                {item.explanation ? (
                                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                    <Info className="w-3.5 h-3.5" />
                                    <span>{item.explanation}</span>
                                  </div>
                                ) : null}
                              </div>
                              <span className="text-xs text-gray-500">w: {item.weight}</span>
                            </div>

                            <div className="mt-3">
                              <input
                                type="range"
                                min={0}
                                max={5}
                                step={1}
                                value={value}
                                onChange={(e) => handleScore(key, Number(e.target.value))}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-gray-500">
                                {[0, 1, 2, 3, 4, 5].map((n) => (
                                  <button
                                    key={n}
                                    onClick={() => handleScore(key, n)}
                                    className={`px-2 py-0.5 rounded ${value === n ? "bg-gray-900 text-white" : "hover:bg-gray-100"}`}
                                  >
                                    {n}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </section>

        {/* Right: Summary */}
        <aside className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Summary</h3>
              <HelpCircle className="w-4 h-4 text-gray-400" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 items-center">
              <div className="bg-gray-50 rounded-xl p-3 border">
                <div className="text-xs text-gray-500">Weighted Score</div>
                <div className="text-3xl font-bold">{totalPct.toFixed(1)}</div>
                <div className="text-xs text-gray-500">out of 100</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border">
                <div className="text-xs text-gray-500">Final Grade</div>
                <div className="text-3xl font-bold">{finalGrade}</div>
                <div className="text-xs text-gray-500">bands editable</div>
              </div>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Score" dataKey="score" stroke="#111827" fill="#111827" fillOpacity={0.4} />
                  <RTooltip formatter={(v) => `${v.toFixed(1)}%`} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bands panel */}
          {showSettings && (
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <h3 className="font-semibold mb-2">Grade Bands</h3>
              <p className="text-xs text-gray-500 mb-3">Highest band first. "min" is the minimum % for that grade.</p>
              <div className="space-y-2">
                {bands.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      className="w-20 px-2 py-1 border rounded-lg"
                      value={b.label}
                      onChange={(e) => {
                        const v = e.target.value || "";
                        setBands((bs) => bs.map((x, i) => (i === idx ? { ...x, label: v } : x)));
                      }}
                    />
                    <span className="text-xs text-gray-500">min %</span>
                    <input
                      className="w-24 px-2 py-1 border rounded-lg"
                      type="number"
                      min={0}
                      max={100}
                      value={b.min}
                      onChange={(e) => {
                        const v = clamp(Number(e.target.value), 0, 100);
                        setBands((bs) => bs.map((x, i) => (i === idx ? { ...x, min: v } : x)));
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">Tip: A ≥85, B ≥70, C ≥55, D ≥40, else E.</p>
            </div>
          )}
        </aside>
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-8 text-xs text-gray-500">
        <p>Configurable, client-side app. Use the header to upload a <code>config.json</code> if you modify KPIs/weights.</p>
      </footer>
    </div>
  );
}
