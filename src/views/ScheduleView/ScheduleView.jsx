// Schedule page — review forecast + study calendar, modeled on Anki's
// "Future Due" forecast and the contribution-style review calendar.
// The forecast + summary tiles compute real numbers from the decks'
// SM2 nextReview dates; the calendar heatmap and streak are placeholder
// shells for now (we don't yet persist a per-day review history).

import { useMemo } from "react";
import useTheme from "../../theme/useTheme.js";
import TopBar from "../../components/TopBar/TopBar.jsx";

const DAY_MS = 86400000;
const FORECAST_DAYS = 14;

export default function ScheduleView({ decks = [], onNavigate }) {
  const { T } = useTheme();
  const containerStyle = {
    maxWidth: 1080, margin: "0 auto",
    padding: "calc(28px + var(--sat)) calc(32px + var(--sar)) calc(40px + var(--sab)) calc(32px + var(--sal))",
    fontFamily: T.fontBody, background: T.bg, width: "100%", boxSizing: "border-box",
  };

  // ---- Real forecast from SM2 nextReview dates ----
  const { buckets, overdue, dueToday, dueWeek, totalScheduled } = useMemo(() => {
    const buckets = new Array(FORECAST_DAYS).fill(0);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const todayMs = start.getTime();
    let overdue = 0, totalScheduled = 0;
    for (const deck of decks) {
      for (const c of (deck.cards || [])) {
        totalScheduled++;
        const nr = c.nextReview ?? 0;
        if (nr < todayMs) { overdue++; continue; }
        const idx = Math.floor((nr - todayMs) / DAY_MS);
        if (idx >= 0 && idx < FORECAST_DAYS) buckets[idx]++;
      }
    }
    const dueToday = overdue + buckets[0];
    const dueWeek = overdue + buckets.slice(0, 7).reduce((a, b) => a + b, 0);
    return { buckets, overdue, dueToday, dueWeek, totalScheduled };
  }, [decks]);

  const maxBucket = Math.max(1, overdue, ...buckets);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column" }}>
      <TopBar view="schedule" onNavigate={onNavigate} />
      <div style={containerStyle}>
        <PageHeader T={T} title="Schedule" subtitle="Your upcoming reviews at a glance" />

        {/* Summary tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <StatTile T={T} label="Due today" value={dueToday} accent={T.due} icon={<BellIcon />} />
          <StatTile T={T} label="Due this week" value={dueWeek} accent={T.easy} icon={<CalendarIcon />} />
          <StatTile T={T} label="Overdue" value={overdue} accent={T.hard} icon={<ClockIcon />} />
          <StatTile T={T} label="Total scheduled" value={totalScheduled} accent={T.good} icon={<LayersIcon />} />
        </div>

        {/* Review forecast bar chart (real) */}
        <SectionCard T={T} title="Review forecast" subtitle={`Cards coming due over the next ${FORECAST_DAYS} days`}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180, paddingTop: 8 }}>
            {buckets.map((n, i) => {
              const date = new Date(); date.setHours(0, 0, 0, 0); date.setTime(date.getTime() + i * DAY_MS);
              const pct = (n / maxBucket) * 100;
              const isToday = i === 0;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: n > 0 ? T.textMid : T.textLight, height: 14 }}>{n > 0 ? n : ""}</div>
                  <div style={{ width: "100%", height: 120, display: "flex", alignItems: "flex-end" }}>
                    <div style={{
                      width: "100%", height: `${Math.max(pct, n > 0 ? 6 : 0)}%`,
                      borderRadius: "5px 5px 0 0",
                      background: isToday ? T.due : T.easy,
                      opacity: n > 0 ? 1 : 0.25,
                      transition: "height 0.3s ease",
                      minHeight: n > 0 ? 4 : 2,
                    }} />
                  </div>
                  <div style={{ fontSize: 9.5, color: T.textLight, fontWeight: isToday ? 700 : 500 }}>
                    {isToday ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Calendar heatmap (placeholder) + streak */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
          <SectionCard T={T} title="Study calendar" subtitle="Review activity over the last 5 weeks" badge="Preview">
            <CalendarHeatmap T={T} />
          </SectionCard>
          <SectionCard T={T} title="Current streak" subtitle="Consecutive days studied" badge="Preview">
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: T.dueBg, color: T.due,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <FlameIcon />
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: T.text, fontFamily: T.font, lineHeight: 1 }}>—</div>
                <div style={{ fontSize: 12.5, color: T.textMid, marginTop: 6 }}>
                  Streak tracking arrives with daily review history.
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ---- Shared bits ----

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
        <div style={{ fontSize: 26, fontWeight: 700, color: T.text, fontFamily: T.font, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: T.textMid, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </div>
  );
}

function SectionCard({ T, title, subtitle, badge, children }) {
  return (
    <div style={{
      padding: "18px 20px", borderRadius: T.radiusLg,
      background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow1,
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

function CalendarHeatmap({ T }) {
  // Placeholder grid — 5 weeks x 7 days. Mock intensity by index so it
  // reads as a real heatmap; swapped for actual history later.
  const weeks = 5, days = 7;
  const levels = [T.bgSub, `${T.good}40`, `${T.good}70`, `${T.good}a0`, T.good];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, 1fr)`, gap: 6 }}>
        {Array.from({ length: weeks }).map((_, w) => (
          <div key={w} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: days }).map((_, d) => {
              const seed = (w * 7 + d * 3) % 5; // deterministic mock pattern
              return (
                <div key={d} style={{
                  aspectRatio: "1 / 1", borderRadius: 4,
                  background: levels[seed], border: `1px solid ${T.border}`,
                }} />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 11, color: T.textLight }}>
        Less
        {levels.map((c, i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c, border: `1px solid ${T.border}` }} />)}
        More
      </div>
    </div>
  );
}

// ---- icons ----
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const LayersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
  </svg>
);
const FlameIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);
