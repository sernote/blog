import { useState, useMemo, useCallback } from "react";

const TIERS = [
  { id: "budget", label: "Бюджет / скорость", color: "#4ade80" },
  { id: "balanced", label: "Баланс", color: "#60a5fa" },
  { id: "frontier", label: "Фронтир", color: "#e879f9" },
];

const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek V3.2",
    color: "#4ade80",
    tier: "budget",
    pMiss: 0.28,
    pHit: 0.028,
    pOut: 0.42,
    writeMultiplier: 1.0,
    minTokens: 64,
    cacheType: "auto",
  },
  {
    id: "gemini-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    color: "#34d399",
    tier: "budget",
    pMiss: 0.1,
    pHit: 0.01,
    pOut: 0.4,
    writeMultiplier: 1.0,
    minTokens: 1024,
    cacheType: "auto",
  },
  {
    id: "gemini-flash",
    name: "Gemini 2.5 Flash",
    color: "#38bdf8",
    tier: "balanced",
    pMiss: 0.3,
    pHit: 0.03,
    pOut: 2.5,
    writeMultiplier: 1.0,
    minTokens: 1024,
    cacheType: "auto",
  },
  {
    id: "haiku",
    name: "Claude Haiku 4.5",
    color: "#f472b6",
    tier: "balanced",
    pMiss: 1.0,
    pHit: 0.1,
    pOut: 5.0,
    writeMultiplier: 1.25,
    minTokens: 4096,
    cacheType: "explicit",
  },
  {
    id: "gemini-pro",
    name: "Gemini 2.5 Pro",
    color: "#2dd4bf",
    tier: "balanced",
    pMiss: 1.25,
    pHit: 0.125,
    pOut: 10.0,
    writeMultiplier: 1.0,
    minTokens: 2048,
    cacheType: "auto",
  },
  {
    id: "gpt53",
    name: "GPT-5.3 Instant",
    color: "#fb923c",
    tier: "balanced",
    pMiss: 1.75,
    pHit: 0.175,
    pOut: 14.0,
    writeMultiplier: 1.0,
    minTokens: 1024,
    cacheType: "auto",
  },
  {
    id: "sonnet",
    name: "Claude Sonnet 4.6",
    color: "#e879f9",
    tier: "frontier",
    pMiss: 3.0,
    pHit: 0.3,
    pOut: 15.0,
    writeMultiplier: 1.25,
    minTokens: 1024,
    cacheType: "explicit",
  },
  {
    id: "gpt54",
    name: "GPT-5.4",
    color: "#fbbf24",
    tier: "frontier",
    pMiss: 2.5,
    pHit: 0.25,
    pOut: 15.0,
    writeMultiplier: 1.0,
    minTokens: 1024,
    cacheType: "auto",
  },
  {
    id: "opus",
    name: "Claude Opus 4.6",
    color: "#c084fc",
    tier: "frontier",
    pMiss: 5.0,
    pHit: 0.5,
    pOut: 25.0,
    writeMultiplier: 1.25,
    minTokens: 1024,
    cacheType: "explicit",
  },
];

function calcCost(provider, S, D, O, h, requestsPerDay) {
  const { pMiss, pHit, pOut, writeMultiplier, minTokens } = provider;
  const hitRate = S >= minTokens ? h : 0;
  const missRate = 1 - hitRate;

  const cacheWriteCost =
    (S * missRate * requestsPerDay * pMiss * writeMultiplier) / 1_000_000;
  const cacheReadCost = (S * hitRate * requestsPerDay * pHit) / 1_000_000;
  const dynamicCost = (D * requestsPerDay * pMiss) / 1_000_000;
  const outputCost = (O * requestsPerDay * pOut) / 1_000_000;
  const total = cacheWriteCost + cacheReadCost + dynamicCost + outputCost;

  return {
    total,
    cacheWriteCost,
    cacheReadCost,
    dynamicCost,
    outputCost,
    outputShare: total > 0 ? outputCost / total : 0,
    effectiveHitRate: hitRate,
    belowMinTokens: S < minTokens,
  };
}

function calcBreakEven(provider) {
  const { pMiss, pHit, writeMultiplier } = provider;
  if (writeMultiplier === 1.0) return 0;
  const k = writeMultiplier;
  const hMin = (pMiss * (k - 1)) / (pMiss * k - pHit);
  return Math.max(0, Math.min(1, hMin));
}

const PRESETS = [
  { label: "RAG-агент", S: 10000, D: 200, O: 300, h: 0.9, rps: 2000 },
  { label: "Классификация", S: 8000, D: 200, O: 20, h: 0.9, rps: 5000 },
  { label: "Большой контекст", S: 50000, D: 500, O: 500, h: 0.95, rps: 1000 },
];

const mono = "'JetBrains Mono', 'Fira Code', monospace";

function Slider({ label, value, min, max, step, onChange, format, hint }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: mono }}>{label}</span>
        <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, fontFamily: mono }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%", appearance: "none", height: 3, borderRadius: 2,
          background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${pct}%, #1e293b ${pct}%, #1e293b 100%)`,
          outline: "none", cursor: "pointer",
        }}
      />
      {hint && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function ModelToggle({ provider, enabled, onToggle }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
      padding: "3px 0", opacity: enabled ? 1 : 0.35, transition: "opacity 0.15s",
    }}>
      <input type="checkbox" checked={enabled} onChange={onToggle} style={{ display: "none" }} />
      <div style={{
        width: 14, height: 14, borderRadius: 3,
        border: `1.5px solid ${enabled ? provider.color : "#334155"}`,
        background: enabled ? provider.color + "22" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s", flexShrink: 0,
      }}>
        {enabled && <div style={{ width: 6, height: 6, borderRadius: 1, background: provider.color }} />}
      </div>
      <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: mono }}>{provider.name}</span>
    </label>
  );
}

function CostBar({ provider, result, maxCost }) {
  const pct = maxCost > 0 ? (result.total / maxCost) * 100 : 0;
  const isWinner = result.isWinner;
  return (
    <div style={{
      marginBottom: 8, padding: "10px 14px",
      background: isWinner ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
      borderRadius: 8,
      border: `1px solid ${isWinner ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.04)"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: provider.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: result.belowMinTokens ? "#475569" : "#cbd5e1", fontFamily: mono }}>
            {provider.name}
            {result.belowMinTokens && (
              <span style={{ color: "#ef4444", marginLeft: 6, fontSize: 10 }}>мин. {provider.minTokens} ток.</span>
            )}
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: isWinner ? "#a5b4fc" : "#64748b", fontFamily: mono }}>
          ${result.total.toFixed(2)}
        </span>
      </div>
      <div style={{ height: 4, background: "#0f172a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${Math.max(pct, 0.5)}%`,
          background: result.belowMinTokens ? "#334155" : `linear-gradient(90deg, ${provider.color}88, ${provider.color})`,
          borderRadius: 2, transition: "width 0.3s ease",
        }} />
      </div>
      {!result.belowMinTokens && (
        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
          {[
            { label: "write", val: result.cacheWriteCost },
            { label: "read", val: result.cacheReadCost },
            { label: "dyn", val: result.dynamicCost },
            { label: "out", val: result.outputCost },
          ].map(({ label, val }) => (
            <span key={label} style={{ fontSize: 10, color: "#475569", fontFamily: mono }}>
              {label}: ${val.toFixed(2)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BreakEvenChart({ provider, S, D, O, requestsPerDay }) {
  if (provider.writeMultiplier === 1.0) return null;
  const numPoints = 50;
  const breakEven = calcBreakEven(provider);
  const costs = Array.from({ length: numPoints + 1 }, (_, i) => {
    const hr = i / numPoints;
    return calcCost(provider, S, D, O, hr, requestsPerDay).total;
  });
  const maxC = Math.max(...costs);
  const minC = Math.min(...costs);
  const range = maxC - minC || 1;
  const w = 220, h = 60;
  const pts = costs.map((c, i) => `${(i / numPoints) * w},${h - ((c - minC) / range) * (h - 8)}`).join(" ");
  const bx = breakEven * w;
  return (
    <div style={{ marginTop: 6, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontFamily: mono }}>
        break-even {provider.name}: h ≥ {(breakEven * 100).toFixed(0)}%
      </div>
      <svg width={w} height={h} style={{ display: "block" }}>
        <polyline points={pts} fill="none" stroke={provider.color} strokeWidth="1.5" opacity="0.7" />
        <line x1={bx} y1={0} x2={bx} y2={h} stroke="#6366f1" strokeWidth="1" strokeDasharray="3,3" />
        <text x={bx + 3} y={12} fill="#818cf8" fontSize="9" fontFamily="monospace">{(breakEven * 100).toFixed(0)}%</text>
      </svg>
    </div>
  );
}

function Warnings({ S, h, winnerResult }) {
  const warnings = [];
  if (S < 1000) warnings.push("S < 1k токенов — кэш практически не даёт эффекта");
  if (winnerResult && winnerResult.outputShare > 0.6) {
    warnings.push(`output = ${(winnerResult.outputShare * 100).toFixed(0)}% затрат — смотрите на P_out, кэш на input не спасёт`);
  }
  if (h < 0.22 && S >= 1000) warnings.push("hit rate < 22% — explicit кэш (Anthropic) не окупается");
  if (warnings.length === 0) return null;
  return (
    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.6 }}>
      {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
    </div>
  );
}

export default function Calculator() {
  const [S, setS] = useState(10000);
  const [D, setD] = useState(200);
  const [O, setO] = useState(300);
  const [h, setH] = useState(0.9);
  const [rps, setRps] = useState(2000);
  const [activePreset, setActivePreset] = useState(0);
  const [showBreakEven, setShowBreakEven] = useState(false);

  const [enabled, setEnabled] = useState(() => {
    const map = {};
    PROVIDERS.forEach((p) => { map[p.id] = true; });
    return map;
  });

  const toggleModel = useCallback((id) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleTier = useCallback((tierId) => {
    const tierProviders = PROVIDERS.filter((p) => p.tier === tierId);
    setEnabled((prev) => {
      const allOn = tierProviders.every((p) => prev[p.id]);
      const next = { ...prev };
      tierProviders.forEach((p) => { next[p.id] = !allOn; });
      return next;
    });
  }, []);

  const activeProviders = PROVIDERS.filter((p) => enabled[p.id]);

  const results = useMemo(() => {
    const res = activeProviders.map((p) => ({
      provider: p,
      result: calcCost(p, S, D, O, h, rps),
    }));
    const validCosts = res.filter((r) => !r.result.belowMinTokens).map((r) => r.result.total);
    const minCost = validCosts.length > 0 ? Math.min(...validCosts) : 0;
    return res.map((r) => ({
      ...r,
      result: {
        ...r.result,
        isWinner: !r.result.belowMinTokens && validCosts.length > 0 && r.result.total === minCost,
      },
    }));
  }, [S, D, O, h, rps, activeProviders]);

  const maxCost = results.length > 0 ? Math.max(...results.map((r) => r.result.total)) : 0;
  const winner = results.find((r) => r.result.isWinner);

  const applyPreset = (i) => {
    const p = PRESETS[i];
    setS(p.S); setD(p.D); setO(p.O); setH(p.h); setRps(p.rps);
    setActivePreset(i);
  };

  const clearPreset = (setter) => (v) => { setter(v); setActivePreset(-1); };

  return (
    <div style={{
      minHeight: "100vh", background: "#080d14",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "32px 16px", fontFamily: mono,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        input[type=range]::-webkit-slider-thumb {
          appearance: none; width: 14px; height: 14px; border-radius: 50%;
          background: #6366f1; cursor: pointer; border: 2px solid #080d14;
          box-shadow: 0 0 0 2px #6366f133;
        }
        input[type=range]::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: #6366f1; cursor: pointer; border: 2px solid #080d14;
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 900 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#6366f1", letterSpacing: 3, marginBottom: 8 }}>LLM CACHE ECONOMICS</div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#e2e8f0", fontWeight: 700, lineHeight: 1.2 }}>
            Effective Cost Calculator
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
            C = S · [(1−h) · P<sub>write</sub> + h · P<sub>hit</sub>] + D · P<sub>miss</sub> + O · P<sub>out</sub>
            <span style={{ color: "#334155", marginLeft: 8 }}>P<sub>write</sub> = P<sub>miss</sub> × k</span>
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {PRESETS.map((p, i) => (
            <button key={i} onClick={() => applyPreset(i)} style={{
              padding: "6px 14px",
              background: activePreset === i ? "#6366f1" : "rgba(255,255,255,0.03)",
              border: `1px solid ${activePreset === i ? "#6366f1" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 6, color: activePreset === i ? "#fff" : "#64748b",
              fontSize: 11, cursor: "pointer", fontFamily: mono, transition: "all 0.15s",
            }}>
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, padding: 20,
            }}>
              <div style={{ fontSize: 11, color: "#475569", letterSpacing: 2, marginBottom: 20 }}>ПАРАМЕТРЫ</div>
              <Slider label="S — статика" value={S} min={0} max={100000} step={500}
                onChange={clearPreset(setS)} format={(v) => v.toLocaleString()} hint="system prompt + RAG + tools" />
              <Slider label="D — динамика" value={D} min={0} max={5000} step={50}
                onChange={clearPreset(setD)} format={(v) => v.toLocaleString()} />
              <Slider label="O — output" value={O} min={0} max={5000} step={10}
                onChange={clearPreset(setO)} format={(v) => v.toLocaleString()} />
              <Slider label="h — hit rate" value={h} min={0} max={1} step={0.01}
                onChange={clearPreset(setH)} format={(v) => `${(v * 100).toFixed(0)}%`} />
              <Slider label="запросов / день" value={rps} min={100} max={50000} step={100}
                onChange={clearPreset(setRps)} format={(v) => v.toLocaleString()} />
            </div>

            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ fontSize: 11, color: "#475569", letterSpacing: 2, marginBottom: 12 }}>МОДЕЛИ</div>
              {TIERS.map((tier) => {
                const tierProviders = PROVIDERS.filter((p) => p.tier === tier.id);
                const allOn = tierProviders.every((p) => enabled[p.id]);
                const someOn = tierProviders.some((p) => enabled[p.id]);
                return (
                  <div key={tier.id} style={{ marginBottom: 10 }}>
                    <div onClick={() => toggleTier(tier.id)} style={{
                      fontSize: 10, color: tier.color, letterSpacing: 1, marginBottom: 4,
                      cursor: "pointer", opacity: someOn ? 1 : 0.4, userSelect: "none",
                    }}>
                      {allOn ? "☑" : someOn ? "◧" : "☐"} {tier.label.toUpperCase()}
                    </div>
                    {tierProviders.map((p) => (
                      <ModelToggle key={p.id} provider={p} enabled={enabled[p.id]} onToggle={() => toggleModel(p.id)} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            {winner && (
              <div style={{
                padding: 14, background: "#0f172a", borderRadius: 10,
                border: "1px solid rgba(99,102,241,0.15)", marginBottom: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>ВЫГОДНЕЕ ВСЕГО</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: winner.provider.color }} />
                      <span style={{ fontSize: 14, color: "#a5b4fc", fontWeight: 700 }}>{winner.provider.name}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, color: "#e2e8f0", fontWeight: 700 }}>
                      ${winner.result.total.toFixed(2)}
                      <span style={{ fontSize: 12, color: "#475569" }}>/день</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                      ${(winner.result.total * 30).toFixed(0)}/мес · ${(winner.result.total * 365).toFixed(0)}/год
                    </div>
                  </div>
                </div>
                <Warnings S={S} h={h} winnerResult={winner?.result} />
              </div>
            )}

            <div style={{ fontSize: 11, color: "#475569", letterSpacing: 2, marginBottom: 12 }}>СТОИМОСТЬ / ДЕНЬ</div>

            {results.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "#334155", fontSize: 12 }}>
                Выберите хотя бы одну модель
              </div>
            )}

            {[...results].sort((a, b) => a.result.total - b.result.total).map(({ provider, result }) => (
              <CostBar key={provider.id} provider={provider} result={result} maxCost={maxCost} />
            ))}

            {showBreakEven && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "#475569", letterSpacing: 2, marginBottom: 12 }}>
                  BREAK-EVEN (explicit cache)
                </div>
                {activeProviders.filter((p) => p.writeMultiplier > 1).map((p) => (
                  <BreakEvenChart key={p.id} provider={p} S={S} D={D} O={O} requestsPerDay={rps} />
                ))}
              </div>
            )}

            <button onClick={() => setShowBreakEven(!showBreakEven)} style={{
              marginTop: 10, width: "100%", padding: 8, background: "transparent",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6,
              color: "#475569", fontSize: 11, cursor: "pointer", fontFamily: mono,
            }}>
              {showBreakEven ? "скрыть" : "показать"} break-even
            </button>

            <div style={{
              marginTop: 12, padding: 14, background: "rgba(239,68,68,0.05)",
              border: "1px solid rgba(239,68,68,0.1)", borderRadius: 8,
            }}>
              <div style={{ fontSize: 10, color: "#ef4444", letterSpacing: 2, marginBottom: 10 }}>НАЛОГ МИГРАЦИИ</div>
              {winner ? (() => {
                const currentCost = winner.result.total;
                const coldResult = calcCost(winner.provider, S, D, O, 0.3, rps);
                const taxPerDay = coldResult.total - currentCost;
                return (
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                      hit rate падает до ~30% при переезде
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#475569" }}>в день</div>
                        <div style={{ fontSize: 14, color: "#fca5a5", fontWeight: 700 }}>+${taxPerDay.toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: "#475569" }}>в месяц</div>
                        <div style={{ fontSize: 14, color: "#fca5a5", fontWeight: 700 }}>+${(taxPerDay * 30).toFixed(0)}</div>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div style={{ fontSize: 11, color: "#334155" }}>Выберите модели для расчёта</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, fontSize: 10, color: "#1e293b", textAlign: "center" }}>
          цены актуальны на март 2026 · @sergeinotevskii
        </div>
      </div>
    </div>
  );
}
