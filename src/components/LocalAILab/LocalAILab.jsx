import { useState, useEffect } from "react";
import useTheme from "../../theme/useTheme.js";
import {
  isWebGpuAvailable,
  getEngine,
  gradeWithLocal,
  unloadEngine,
  isEngineReady,
  isModelDownloaded,
  getActiveModelId,
  SUGGESTED_MODELS,
  DEFAULT_MODEL,
} from "../../utils/webllm.js";

const TEST_CASES = [
  { correctAnswer: "Manzana", studentAnswer: "Manzana", tags: ["translation"], label: "Exact match" },
  { correctAnswer: "Manzana", studentAnswer: "Mantana", tags: ["spelling", "translation"], label: "Spelling typo (with spelling tag)" },
  { correctAnswer: "Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to produce oxygen and glucose.", studentAnswer: "Plants use sunlight to make food.", tags: ["definition"], label: "Vague vs detailed" },
  { correctAnswer: "1492", studentAnswer: "1490", tags: ["date"], label: "Close date (with date tag)" },
];

export default function LocalAILab({ aiSettings, setAiSettings }) {
  const { T } = useTheme();
  const [supported] = useState(() => isWebGpuAvailable());
  // Track model selection in aiSettings if available, otherwise local state
  const settingsModelId = aiSettings?.localModelId;
  const [localModelId, setLocalModelId] = useState(settingsModelId || DEFAULT_MODEL);
  const modelId = settingsModelId || localModelId;
  // Track which models have been downloaded so we can label "Reload (cached)" appropriately
  const [downloadedSet, setDownloadedSet] = useState(() => new Set(SUGGESTED_MODELS.filter(m => isModelDownloaded(m.id)).map(m => m.id)));
  const useLocal = !!aiSettings?.useLocal;
  const setModelId = (id) => {
    setLocalModelId(id);
    if (setAiSettings) setAiSettings(prev => ({ ...prev, localModelId: id }));
  };
  const setUseLocal = (val) => {
    if (setAiSettings) setAiSettings(prev => ({ ...prev, useLocal: val }));
  };
  const [status, setStatus] = useState(() => isEngineReady(settingsModelId || localModelId) ? "ready" : "idle"); // idle | loading | ready | grading | error
  const [progress, setProgress] = useState({ percent: 0, text: "" });
  const [errorMsg, setErrorMsg] = useState(null);
  const [results, setResults] = useState([]); // array of { caseLabel, ...gradeResult }
  const [customCorrect, setCustomCorrect] = useState("");
  const [customStudent, setCustomStudent] = useState("");
  const [customResult, setCustomResult] = useState(null);
  const [streamingText, setStreamingText] = useState("");
  const [currentCaseLabel, setCurrentCaseLabel] = useState("");

  // When the picker switches to a different model, reflect whether THAT model
  // is currently loaded in memory.
  useEffect(() => {
    if (isEngineReady(modelId)) {
      if (status !== "loading" && status !== "grading") setStatus("ready");
    } else {
      // Switched to a model that's not active. Don't blow away in-flight states.
      if (status === "ready") setStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  const loadModel = async () => {
    setStatus("loading");
    setErrorMsg(null);
    setProgress({ percent: 0, text: "Connecting…" });
    try {
      await getEngine(modelId, (report) => {
        setProgress({
          percent: Math.round((report.progress || 0) * 100),
          text: report.text || "Loading…",
        });
      });
      setDownloadedSet(prev => {
        if (prev.has(modelId)) return prev;
        const next = new Set(prev);
        next.add(modelId);
        return next;
      });
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err.message || "Failed to load model");
      setStatus("error");
    }
  };

  const runTestSuite = async () => {
    setStatus("grading");
    setResults([]);
    setStreamingText("");
    for (const tc of TEST_CASES) {
      setCurrentCaseLabel(tc.label);
      setStreamingText("");
      try {
        const res = await gradeWithLocal({
          modelId,
          correctAnswer: tc.correctAnswer,
          studentAnswer: tc.studentAnswer,
          tags: tc.tags,
          onTokenProgress: (text) => setStreamingText(text),
        });
        setResults(prev => [...prev, { caseLabel: tc.label, ...tc, ...res }]);
      } catch (err) {
        setResults(prev => [...prev, { caseLabel: tc.label, ...tc, error: err.message }]);
      }
    }
    setCurrentCaseLabel("");
    setStreamingText("");
    setStatus("ready");
  };

  const runCustom = async () => {
    if (!customCorrect.trim() || !customStudent.trim()) return;
    setStatus("grading");
    setCustomResult(null);
    setCurrentCaseLabel("Custom");
    setStreamingText("");
    try {
      const res = await gradeWithLocal({
        modelId,
        correctAnswer: customCorrect,
        studentAnswer: customStudent,
        tags: [],
        onTokenProgress: (text) => setStreamingText(text),
      });
      setCustomResult(res);
    } catch (err) {
      setCustomResult({ error: err.message });
    }
    setCurrentCaseLabel("");
    setStreamingText("");
    setStatus("ready");
  };

  const handleUnload = async () => {
    await unloadEngine();
    setStatus("idle");
    setResults([]);
    setCustomResult(null);
    setProgress({ percent: 0, text: "" });
  };

  if (!supported) {
    return (
      <div style={{ padding: "12px 14px", borderRadius: T.radius, background: T.dueBg, color: T.due, fontSize: 13, fontFamily: T.fontBody, lineHeight: 1.5 }}>
        WebGPU is not available in this browser. Local AI requires Chrome 113+, Edge 113+, or Safari 18+. Try opening the app in a recent Chromium-based browser or in the Electron build.
      </div>
    );
  }

  const currentModel = SUGGESTED_MODELS.find(m => m.id === modelId);
  const isLoading = status === "loading";
  const isGrading = status === "grading";
  const isReady = status === "ready";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 12, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.5, margin: 0 }}>
        Run grading entirely on your device. Free, private, works offline. First load downloads the model (cached after that).
      </p>

      {/* Model picker */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textMid, fontFamily: T.fontBody, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Model</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SUGGESTED_MODELS.map(m => {
            const isCached = downloadedSet.has(m.id);
            const isLive = isEngineReady(m.id);
            const isSelected = modelId === m.id;
            return (
            <button
              key={m.id}
              onClick={() => { if (status !== "loading" && status !== "grading") setModelId(m.id); }}
              disabled={isLoading || isGrading}
              style={{
                position: "relative",
                padding: "8px 12px", borderRadius: T.radius,
                border: isSelected ? `2px solid ${T.good}` : `1.5px solid ${T.border}`,
                background: isSelected ? T.goodBg : T.card,
                color: isSelected ? T.good : T.textMid,
                fontSize: 12, fontWeight: 600, cursor: (isLoading || isGrading) ? "default" : "pointer",
                fontFamily: T.fontBody, opacity: (isLoading || isGrading) ? 0.6 : 1,
                transition: "all 0.15s", textAlign: "left", flex: "1 1 0", minWidth: 140
              }}
            >
              {(isLive || isCached) && (
                <div title={isLive ? "Loaded in memory" : "Downloaded, not loaded"} style={{
                  position: "absolute", top: 6, right: 6,
                  width: 7, height: 7, borderRadius: "50%",
                  background: isLive ? T.good : T.textLight,
                  boxShadow: isLive ? `0 0 0 2px ${T.goodBg}` : "none"
                }} />
              )}
              <div>{m.name}</div>
              <div style={{ fontSize: 10, color: isSelected ? T.good : T.textLight, fontWeight: 400, marginTop: 2 }}>
                ~{Math.round(m.sizeMb)}MB · {isCached ? "cached" : m.note}
              </div>
            </button>
            );
          })}
        </div>
      </div>

      {/* Status / Load button */}
      {status === "idle" && (() => {
        const cached = downloadedSet.has(modelId);
        return (
          <button onClick={loadModel} style={primaryBtn(T)}>
            {cached
              ? `Reload ${currentModel?.name} (cached, ~5s)`
              : `Load ${currentModel?.name} (~${currentModel?.sizeMb}MB download)`}
          </button>
        );
      })()}

      {isLoading && (
        <div style={{
          padding: "14px 16px", borderRadius: T.radius,
          background: T.bgSub, border: `1px solid ${T.border}`,
          fontFamily: T.fontBody
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 8 }}>
            Loading model… {progress.percent}%
          </div>
          <div style={{ height: 6, borderRadius: 3, background: T.border, overflow: "hidden", marginBottom: 8 }}>
            <div style={{
              width: `${progress.percent}%`, height: "100%",
              background: T.good, transition: "width 0.3s ease"
            }} />
          </div>
          <div style={{ fontSize: 11, color: T.textMid, fontFamily: T.fontBody }}>
            {progress.text}
          </div>
        </div>
      )}

      {status === "error" && (
        <div style={{
          padding: "12px 14px", borderRadius: T.radius,
          background: T.dueBg, color: T.due,
          fontSize: 12, fontFamily: T.fontBody, fontWeight: 500
        }}>
          {errorMsg}
          <button onClick={loadModel} style={{
            marginLeft: 12, padding: "4px 10px", borderRadius: 6,
            border: `1px solid ${T.due}`, background: "transparent", color: T.due,
            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: T.fontBody
          }}>Retry</button>
        </div>
      )}

      {(isReady || isGrading) && (
        <>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderRadius: T.radius,
            background: T.goodBg, border: `1px solid ${T.good}40`
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.good }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.good, fontFamily: T.fontBody }}>
                {currentModel?.name} ready
              </span>
            </div>
            <button onClick={handleUnload} disabled={isGrading} style={{
              fontSize: 11, color: T.textMid, background: "none", border: "none",
              cursor: isGrading ? "default" : "pointer", fontFamily: T.fontBody, fontWeight: 500,
              opacity: isGrading ? 0.5 : 1
            }}>Unload</button>
          </div>

          {/* Use for actual grading toggle */}
          {setAiSettings && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", borderRadius: T.radius,
              background: useLocal ? `${T.perfect}15` : T.cardAlt,
              border: `1px solid ${useLocal ? T.perfect + "60" : T.border}`,
              transition: "all 0.2s"
            }}>
              <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: T.text,
                  fontFamily: T.fontBody, marginBottom: 2
                }}>
                  Use for actual grading
                </div>
                <div style={{
                  fontSize: 11, color: T.textMid, fontFamily: T.fontBody, lineHeight: 1.4
                }}>
                  {useLocal
                    ? `Grading is running on ${currentModel?.name} when you study.`
                    : "Replace cloud AI with this local model in your study sessions."}
                </div>
              </div>
              <button
                role="switch"
                aria-checked={useLocal}
                onClick={() => setUseLocal(!useLocal)}
                disabled={isGrading}
                style={{
                  position: "relative",
                  width: 44, height: 26, borderRadius: 13,
                  border: "none",
                  background: useLocal ? T.perfect : T.border,
                  cursor: isGrading ? "default" : "pointer",
                  flexShrink: 0,
                  transition: "background 0.2s",
                  padding: 0,
                  opacity: isGrading ? 0.5 : 1
                }}
              >
                <div style={{
                  position: "absolute", top: 2, left: useLocal ? 20 : 2,
                  width: 22, height: 22, borderRadius: "50%",
                  background: T.card,
                  transition: "left 0.2s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                }} />
              </button>
            </div>
          )}

          {/* Live streaming output during grading */}
          {isGrading && (
            <div style={{
              padding: "12px 14px", borderRadius: T.radius,
              background: T.bgSub, border: `1px solid ${T.border}`,
              fontFamily: T.fontBody
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 6
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", background: T.good,
                  animation: "pulse 1.2s ease-in-out infinite"
                }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: T.textMid }}>
                  {currentCaseLabel ? `Generating: ${currentCaseLabel}` : "Generating…"}
                </span>
              </div>
              <div style={{
                fontSize: 11, color: T.text, fontFamily: "ui-monospace, SFMono-Regular, monospace",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                maxHeight: 120, overflow: "auto", lineHeight: 1.5
              }}>
                {streamingText || <span style={{ color: T.textLight }}>Waiting for first token…</span>}
              </div>
            </div>
          )}

          {/* Test suite */}
          <div>
            <button onClick={runTestSuite} disabled={isGrading} style={primaryBtn(T, isGrading)}>
              {isGrading ? "Running…" : "Run test suite (4 cases)"}
            </button>
            {results.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {results.map((r, i) => (
                  <ResultRow key={i} result={r} T={T} />
                ))}
              </div>
            )}
          </div>

          {/* Custom test */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMid, fontFamily: T.fontBody, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Try your own</div>
            <input
              value={customCorrect}
              onChange={e => setCustomCorrect(e.target.value)}
              placeholder="Correct answer"
              disabled={isGrading}
              style={textInput(T)}
            />
            <input
              value={customStudent}
              onChange={e => setCustomStudent(e.target.value)}
              placeholder="Student answer"
              disabled={isGrading}
              style={{ ...textInput(T), marginTop: 8 }}
            />
            <button
              onClick={runCustom}
              disabled={isGrading || !customCorrect.trim() || !customStudent.trim()}
              style={{ ...primaryBtn(T, isGrading || !customCorrect.trim() || !customStudent.trim()), marginTop: 10 }}
            >
              {isGrading ? "Grading…" : "Grade"}
            </button>
            {customResult && (
              <div style={{ marginTop: 10 }}>
                <ResultRow
                  result={{
                    caseLabel: "Custom",
                    correctAnswer: customCorrect,
                    studentAnswer: customStudent,
                    ...customResult,
                  }}
                  T={T}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ResultRow({ result, T }) {
  const ratingColors = { 0: T.forgot, 2: T.hard, 3: T.good, 4: T.easy, 5: T.perfect };
  const color = ratingColors[result.rating] || T.textMid;

  if (result.error) {
    return (
      <div style={{
        padding: "10px 12px", borderRadius: T.radius,
        background: T.dueBg, color: T.due,
        fontSize: 12, fontFamily: T.fontBody, fontWeight: 500
      }}>
        <div style={{ fontWeight: 600 }}>{result.caseLabel}</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>{result.error}</div>
      </div>
    );
  }

  return (
    <div style={{
      padding: "10px 12px", borderRadius: T.radius,
      background: T.cardAlt, border: `1px solid ${T.border}`,
      fontFamily: T.fontBody
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textMid, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {result.caseLabel}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {result.tokensPerSec != null && (
            <span style={{ fontSize: 10, color: T.textLight }}>
              {result.tokensPerSec} tok/s · {(result.ms / 1000).toFixed(1)}s
            </span>
          )}
          <span style={{
            padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
            background: `${color}20`, color
          }}>
            {result.label} {result.rating}/5
          </span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.textMid, marginBottom: 4 }}>
        <strong style={{ color: T.text }}>"{result.correctAnswer}"</strong> → "{result.studentAnswer}"
      </div>
      <div style={{ fontSize: 12, color: T.text, lineHeight: 1.45, fontStyle: "italic" }}>
        {result.explanation}
      </div>
    </div>
  );
}

const primaryBtn = (T, disabled) => ({
  padding: "11px 18px", borderRadius: T.radius, border: "none",
  background: disabled ? T.bgSub : T.text, color: disabled ? T.textLight : T.card,
  fontWeight: 600, fontSize: 13, fontFamily: T.fontBody,
  cursor: disabled ? "default" : "pointer",
  transition: "all 0.15s", width: "100%",
  boxShadow: disabled ? "none" : "0 2px 6px rgba(0,0,0,0.1)"
});

const textInput = (T) => ({
  width: "100%", padding: "9px 12px", borderRadius: T.radius,
  border: `1.5px solid ${T.border}`, fontSize: 13,
  fontFamily: T.fontBody, color: T.text, background: T.inputBg,
  outline: "none", boxSizing: "border-box"
});
