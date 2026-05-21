// Statistics page — modeled on Anki's stats screen: card-count
// breakdown by maturity, reviews-over-time, answer-button distribution,
// retention, and per-deck totals. Card counts + maturity + average ease
// are computed for real from the SM2 fields on each card; the
// time-series charts (reviews/day, answer buttons, retention) are
// placeholder shells until we persist a per-review history log.

import { useMemo } from "react";
import useTheme from "../../theme/useTheme.js";
import TopBar from "../../components/TopBar/TopBar.jsx";

const MATURE_DAYS = 21; // Anki's mature threshold

export default function StatisticsView({ decks = [], onNavigate }) {
  const { T } = useTheme();
  const containerStyle = {
    maxWidth: 1080, margin: "0 auto",
    padding: "calc(28px + var(--sat)) calc(32px + var(--sar)) calc(40px + var(--sab)) calc(32px + var(--sal))",
    fontFamily: T.fontBody, background: T.bg, width: "100%", boxSizing: "border-box",
  };

  // ---- Real counts from SM2 fields ----
  const stats = useMemo(() => {
    let total = 0, neu = 0, young = 0, mature = 0, easeSum = 0, easeN = 0;
    const perDeck = [];
    for (const deck of decks) {
      let dTotal = 0, dNew = 0, dYoung = 0, dMature = 0;
      for (const c of (deck.cards || [])) {
        total++; dTotal++;
        const reviewed = (c.repetitions ?? 0) > 0 || (c.lastReview ?? 0) > 0;
        if (!reviewed) { neu++; dNew++; }
        else if ((c.interval ?? 0) >= MATURE_DAYS) { mature++; dMature++; }
        else { young++; dYoung++; }
        if (c.easeFactor) { easeSum += c.easeFactor; easeN++; }
      }
      perDeck.push({ id: deck.id, name: deck.name, total: dTotal, neu: dNew, young: dYoung, mature: dMature });
    }
    const avgEase = easeN ? Math.round((easeSum / easeN) * 100) : 0; // % (2.5 → 250%)
    return { total, neu, young, mature, avgEase, perDeck };
  }, [decks]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column" }}>
      <TopBar view="statistics" onNavigate={onNavigate} />
      <div style={containerStyle}>
        <PageHeader T={T} title="Statistics" subtitle="How your collection is progressing" />

        {/* Stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          <StatTile T={T} label="Total cards" value={stats.total} accent={T.text} icon={<LayersIcon />} />
          <StatTile T={T} label="Mature" value={stats.mature} accent={T.good} icon={<CheckIcon />} />
          <StatTile T={T} label="Young" value={stats.young} accent={T.easy} icon={<SeedlingIcon />} />
          <StatTile T={T} label="New" value={stats.neu} accent={T.hard} icon={<SparkIcon />} />
          <StatTile T={T} label="Avg. ease" value={stats.avgEase ? `${stats.avgEase}%` : "—"} accent={T.perfect} icon={<GaugeIcon />} />
        </div>

        {/* Card maturity stacked bar (real) */}
        <SectionCard T={T} title="Card counts" subtitle="Breakdown by maturity">
          <MaturityBar T={T} neu={stats.neu} young={stats.young} mature={stats.mature} />
        </SectionCard>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
          {/* Reviews over time (placeholder) */}
          <SectionCard T={T} title="Reviews" subtitle="Cards reviewed per day" badge="Preview">
            <MockBars T={T} color={T.easy} count={21} />
          </SectionCard>

          {/* Answer buttons (placeholder) */}
          <SectionCard T={T} title="Answer buttons" subtitle="How you graded your reviews" badge="Preview">
            <AnswerButtons T={T} />
          </SectionCard>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
          {/* Retention (placeholder) */}
          <SectionCard T={T} title="True retention" subtitle="Share of reviews answered correctly" badge="Preview">
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "6px 0" }}>
              <Donut T={T} percent={0} placeholder />
              <div style={{ fontSize: 12.5, color: T.textMid, lineHeight: 1.5 }}>
                Retention is calculated once daily review history is recorded.
              </div>
            </div>
          </SectionCard>

          {/* Hourly breakdown (placeholder) */}
          <SectionCard T={T} title="Reviews by hour" subtitle="When you study during the day" badge="Preview">
            <MockBars T={T} color={T.perfect} count={24} compact />
          </SectionCard>
        </div>

        {/* By-deck table (real counts) */}
        <SectionCard T={T} title="By deck" subtitle="Card maturity per deck" style={{ marginTop: 16 }}>
          {stats.perDeck.length === 0 ? (
            <div style={{ fontSize: 13, color: T.textLight, padding: "6px 0" }}>No decks yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 56px 56px 56px", gap: 8, padding: "0 10px 8px", fontSize: 11, fontWeight: 700, color: T.textLight, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <span>Deck</span><span style={{ textAlign: "right" }}>New</span><span style={{ textAlign: "right" }}>Young</span><span style={{ textAlign: "right" }}>Mature</span><span style={{ textAlign: "right" }}>Total</span>
              </div>
              {stats.perDeck.map(d => (
                <div key={d.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 56px 56px 56px 56px", gap: 8,
                  padding: "9px 10px", borderRadius: 8, fontSize: 13, color: T.text,
                  background: "transparent", transition: "background 0.12s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bgSub}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                  <span style={{ textAlign: "right", color: T.hard }}>{d.neu}</span>
                  <span style={{ textAlign: "right", color: T.easy }}>{d.young}</span>
                  <span style={{ textAlign: "right", color: T.good }}>{d.mature}</span>
                  <span style={{ textAlign: "right", color: T.textMid, fontWeight: 600 }}>{d.total}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ---- shared bits ----

function PageHeader({ T, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, fontFamily: T.fontBody, margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13.5, color: T.textMid, margin: "4px 0 0" }}>{subtitle}</p>}
    </div>
  );
}

function StatTile({ T, label, value, accent, icon }) {
  return (
    <div style={{
      padding: "16px 18px", borderRadius: T.radiusLg,
      background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow1,
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `${accent}1f`, color: accent,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.text, fontFamily: T.font, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: T.textMid, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </div>
  );
}

function SectionCard({ T, title, subtitle, badge, children, style }) {
  return (
    <div style={{
      padding: "18px 20px", borderRadius: T.radiusLg,
      background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow1, ...style,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: T.fontBody, margin: 0 }}>{title}</h3>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
            color: T.textMid, background: T.bgSub, border: `1px solid ${T.border}`,
            padding: "1px 7px", borderRadius: 999,
          }}>{badge}</span>
        )}
      </div>
      {subtitle && <p style={{ fontSize: 12.5, color: T.textMid, margin: "0 0 14px" }}>{subtitle}</p>}
      {children}
    </div>
  );
}

function MaturityBar({ T, neu, young, mature }) {
  const total = Math.max(1, neu + young + mature);
  const segs = [
    { label: "New", n: neu, color: T.hard },
    { label: "Young", n: young, color: T.easy },
    { label: "Mature", n: mature, color: T.good },
  ];
  return (
    <div>
      <div style={{ display: "flex", height: 18, borderRadius: 6, overflow: "hidden", background: T.bgSub, border: `1px solid ${T.border}` }}>
        {segs.map(s => s.n > 0 && (
          <div key={s.label} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.n}`} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
        {segs.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.textMid }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            {s.label} <strong style={{ color: T.text, fontWeight: 700 }}>{s.n}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockBars({ T, color, count, compact }) {
  // Deterministic pseudo-random heights so the placeholder reads as a
  // real chart without looking uniform. Muted so it clearly reads as
  // sample data.
  const bars = Array.from({ length: count }, (_, i) => 20 + ((i * 37 + 13) % 80));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: compact ? 3 : 5, height: compact ? 90 : 130 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          flex: 1, height: `${h}%`, minWidth: 0,
          borderRadius: "4px 4px 0 0", background: color, opacity: 0.4,
        }} />
      ))}
    </div>
  );
}

function AnswerButtons({ T }) {
  const rows = [
    { label: "Again", color: T.forgot },
    { label: "Hard", color: T.hard },
    { label: "Good", color: T.good },
    { label: "Easy", color: T.easy },
  ];
  // Placeholder proportions.
  const widths = [12, 22, 50, 16];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 48, fontSize: 12, color: T.textMid, fontWeight: 600 }}>{r.label}</span>
          <div style={{ flex: 1, height: 14, borderRadius: 5, background: T.bgSub, overflow: "hidden", border: `1px solid ${T.border}` }}>
            <div style={{ width: `${widths[i]}%`, height: "100%", background: r.color, opacity: 0.5 }} />
          </div>
          <span style={{ width: 28, textAlign: "right", fontSize: 11, color: T.textLight }}>—</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ T, percent, placeholder }) {
  const r = 30, c = 2 * Math.PI * r;
  const dash = placeholder ? 0 : (percent / 100) * c;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
      <circle cx="42" cy="42" r={r} fill="none" stroke={T.bgSub} strokeWidth="10" />
      <circle cx="42" cy="42" r={r} fill="none" stroke={T.good} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`} transform="rotate(-90 42 42)" />
      <text x="42" y="47" textAnchor="middle" fontSize="16" fontWeight="700" fill={T.text} fontFamily={T.font}>
        {placeholder ? "—" : `${percent}%`}
      </text>
    </svg>
  );
}

// ---- icons ----
const LayersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
  </svg>
);
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const SeedlingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V12" /><path d="M12 12C12 8 9 6 4 6c0 4 3 6 8 6z" /><path d="M12 10c0-3 3-5 8-5 0 3-3 5-8 5z" />
  </svg>
);
const SparkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </svg>
);
const GaugeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 14l4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </svg>
);
