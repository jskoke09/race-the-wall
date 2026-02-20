import { useState, useEffect, useCallback } from "react";

const WALL_HEIGHTS = ["10m", "15m (Standard)"];
const ENERGY_LEVELS = ["Exhausted", "Low", "Moderate", "Strong", "Peak"];
const GRIP_FEEL = ["Slipping", "Shaky", "Okay", "Dialed", "Locked In"];
const FOCUS_AREAS = ["Starts", "Transitions", "Footwork", "Upper Body", "Route Reading", "Endurance", "Mental Game", "Full Runs"];

const defaultSession = () => ({
  id: Date.now(),
  date: new Date().toISOString().split("T")[0],
  gymName: "",
  duration: 60,
  energyBefore: 2,
  energyAfter: 2,
  gripFeel: 2,
  runs: [],
  focusAreas: [],
  notes: "",
  nextSessionGoals: "",
  psychLevel: 3,
});

const defaultRun = () => ({
  id: Date.now(),
  time: "",
  wallHeight: "15m (Standard)",
  falseStart: false,
  fall: false,
  topped: true,
  splitBottom: "",
  splitTop: "",
  notes: "",
  warmup: false,
});

// localStorage helpers
const loadSessions = () => {
  try {
    const data = localStorage.getItem("speed-sessions");
    return data ? JSON.parse(data) : [];
  } catch { return []; }
};
const saveSessions = (sessions) => {
  try { localStorage.setItem("speed-sessions", JSON.stringify(sessions)); } catch (e) { console.error(e); }
};
const loadGoals = () => {
  try {
    const data = localStorage.getItem("speed-goals");
    return data ? JSON.parse(data) : {
      targetTime: "7.00",
      sessionsPerWeek: 3,
      compDate: "",
      compName: "",
      notes: "Commit to speed. Every session counts.",
    };
  } catch {
    return { targetTime: "7.00", sessionsPerWeek: 3, compDate: "", compName: "", notes: "Commit to speed. Every session counts." };
  }
};
const saveGoals = (goals) => {
  try { localStorage.setItem("speed-goals", JSON.stringify(goals)); } catch (e) { console.error(e); }
};

// ── Stat helpers ──
const getWeekSessions = (sessions) => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return sessions.filter((s) => new Date(s.date) >= weekAgo);
};

const getStreak = (sessions) => {
  if (!sessions.length) return 0;
  const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split("T")[0];
    if (sorted.some((s) => s.date === dateStr)) { streak++; } else if (i > 0) { break; }
  }
  return streak;
};

const getPB = (sessions) => {
  let best = Infinity;
  sessions.forEach((s) => {
    s.runs?.forEach((r) => {
      const t = parseFloat(r.time);
      if (t > 0 && r.topped && !r.fall && !r.falseStart && !r.warmup) {
        if (t < best) best = t;
      }
    });
  });
  return best === Infinity ? null : best;
};

const getRecentPB = (sessions, days = 7) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recent = sessions.filter((s) => new Date(s.date) >= cutoff);
  return getPB(recent);
};

const getAvgTime = (sessions, days = 30) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recent = sessions.filter((s) => new Date(s.date) >= cutoff);
  const validTimes = [];
  recent.forEach((s) => {
    s.runs?.forEach((r) => {
      const t = parseFloat(r.time);
      if (t > 0 && r.topped && !r.fall && !r.warmup) validTimes.push(t);
    });
  });
  if (!validTimes.length) return null;
  return (validTimes.reduce((a, b) => a + b, 0) / validTimes.length).toFixed(2);
};

const getTotalRuns = (sessions) => {
  return sessions.reduce((t, s) => t + (s.runs?.filter((r) => !r.warmup).length || 0), 0);
};

const formatTime = (t) => {
  if (!t && t !== 0) return "—";
  return parseFloat(t).toFixed(2) + "s";
};

// ── Micro Components ──
const TimeChip = ({ time, pb, small }) => {
  const t = parseFloat(time);
  const isPB = pb && t === pb;
  return (
    <span style={{
      display: "inline-block", padding: small ? "2px 8px" : "4px 12px", borderRadius: "4px",
      background: isPB ? "rgba(122,200,122,0.2)" : t < 7 ? "rgba(232,170,122,0.2)" : t < 8 ? "rgba(232,200,122,0.15)" : t < 10 ? "rgba(200,200,200,0.1)" : "rgba(240,235,227,0.06)",
      border: isPB ? "1px solid rgba(122,200,122,0.4)" : "1px solid transparent",
      color: isPB ? "#7ac87a" : t < 7 ? "#e8aa7a" : t < 8 ? "#e8c87a" : "#f0ebe3",
      fontFamily: "'DM Mono', monospace", fontSize: small ? "12px" : "14px", fontWeight: 700, letterSpacing: "0.5px",
    }}>
      {formatTime(time)}{isPB && " 🏆"}
    </span>
  );
};

const StatCard = ({ label, value, sub, accent }) => (
  <div style={{
    background: "rgba(240,235,227,0.04)", border: "1px solid rgba(240,235,227,0.08)",
    borderRadius: "8px", padding: "16px", flex: "1 1 140px", minWidth: "120px",
  }}>
    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "28px", fontWeight: 700, color: accent || "#e87a7a", lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(240,235,227,0.45)", marginTop: "6px", fontWeight: 600 }}>{label}</div>
    {sub && <div style={{ fontSize: "12px", color: "rgba(240,235,227,0.35)", marginTop: "2px" }}>{sub}</div>}
  </div>
);

const SliderInput = ({ label, value, onChange, labels, max }) => (
  <div style={{ marginBottom: "16px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
      <span style={{ fontSize: "12px", color: "rgba(240,235,227,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>{label}</span>
      <span style={{ fontSize: "13px", color: "#e87a7a", fontFamily: "'DM Mono', monospace" }}>{labels[value]}</span>
    </div>
    <div style={{ display: "flex", gap: "4px" }}>
      {labels.map((l, i) => (
        <button key={i} onClick={() => onChange(i)} style={{
          flex: 1, padding: "8px 4px",
          background: i <= value ? `rgba(232,122,122,${0.15 + (i / max) * 0.35})` : "rgba(240,235,227,0.04)",
          border: i === value ? "1px solid rgba(232,122,122,0.6)" : "1px solid rgba(240,235,227,0.08)",
          borderRadius: "4px", color: i <= value ? "#e87a7a" : "rgba(240,235,227,0.3)",
          fontSize: "10px", cursor: "pointer", fontFamily: "'DM Mono', monospace", transition: "all 0.2s",
        }}>{l.slice(0, 4)}</button>
      ))}
    </div>
  </div>
);

// ── Main App ──
function App() {
  const [view, setView] = useState("dashboard");
  const [sessions, setSessions] = useState(() => loadSessions());
  const [goals, setGoals] = useState(() => loadGoals());
  const [currentSession, setCurrentSession] = useState(null);
  const [editingRun, setEditingRun] = useState(null);
  const [expandedSession, setExpandedSession] = useState(null);

  const persist = useCallback((newSessions) => {
    setSessions(newSessions);
    saveSessions(newSessions);
  }, []);

  const persistGoals = useCallback((newGoals) => {
    setGoals(newGoals);
    saveGoals(newGoals);
  }, []);

  const pb = getPB(sessions);

  // ── Dashboard ──
  const renderDashboard = () => {
    const weekSessions = getWeekSessions(sessions);
    const streak = getStreak(sessions);
    const allTimePB = pb;
    const weekPB = getRecentPB(sessions, 7);
    const avg = getAvgTime(sessions, 30);
    const totalRuns = getTotalRuns(sessions);
    const weekTarget = goals?.sessionsPerWeek || 3;

    return (
      <div>
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "3px", color: "rgba(240,235,227,0.3)", marginBottom: "8px", fontWeight: 600 }}>Speed Climbing</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "36px", fontWeight: 800, color: "#f0ebe3", margin: 0, lineHeight: 1.1 }}>Race The Wall.</h1>
          {goals?.compName && (
            <div style={{ marginTop: "12px", fontSize: "13px", color: "rgba(240,235,227,0.45)" }}>
              Training for <span style={{ color: "#e87a7a" }}>{goals.compName}</span>
              {goals.compDate && <span> · {Math.ceil((new Date(goals.compDate) - new Date()) / 86400000)} days out</span>}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "28px" }}>
          <StatCard label="Personal Best" value={allTimePB ? formatTime(allTimePB) : "—"} accent="#7ac87a" />
          <StatCard label="Week PB" value={weekPB ? formatTime(weekPB) : "—"} accent="#e8aa7a" />
          <StatCard label="Avg (30d)" value={avg ? avg + "s" : "—"} accent="#e87a7a" />
          <StatCard label="Total Runs" value={totalRuns} sub={`${sessions.length} sessions`} accent="#e8c87a" />
        </div>

        {/* Weekly Progress */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(240,235,227,0.4)", fontWeight: 600 }}>Weekly Goal</span>
            <span style={{ fontSize: "12px", color: "#e87a7a", fontFamily: "'DM Mono', monospace" }}>{weekSessions.length} / {weekTarget}</span>
          </div>
          <div style={{ height: "6px", background: "rgba(240,235,227,0.06)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.min(100, (weekSessions.length / weekTarget) * 100)}%`,
              background: weekSessions.length >= weekTarget ? "linear-gradient(90deg, #7ac87a, #5ab85a)" : "linear-gradient(90deg, #e87a7a, #d45a5a)",
              borderRadius: "3px", transition: "width 0.6s ease",
            }} />
          </div>
        </div>

        {/* Streak */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "28px" }}>
          <StatCard label="Streak" value={`${streak}d`} accent="#e87a7a" />
          <StatCard label="This Week" value={`${weekSessions.length}/${weekTarget}`} accent={weekSessions.length >= weekTarget ? "#7ac87a" : "#e87a7a"} />
        </div>

        {/* Target Time */}
        {goals?.targetTime && (
          <div style={{
            background: "rgba(232,122,122,0.06)", border: "1px solid rgba(232,122,122,0.15)",
            borderRadius: "8px", padding: "16px", marginBottom: "28px",
            display: "flex", alignItems: "center", gap: "16px",
          }}>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(240,235,227,0.4)", fontWeight: 600 }}>Target Time</div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "20px", fontWeight: 700, color: "#e87a7a" }}>{goals.targetTime}s</span>
            {allTimePB && (
              <div style={{ fontSize: "12px", color: "rgba(240,235,227,0.4)", flex: 1 }}>
                {(allTimePB - parseFloat(goals.targetTime)).toFixed(2)}s to go
              </div>
            )}
          </div>
        )}

        {/* New Session */}
        <button onClick={() => { setCurrentSession(defaultSession()); setView("log"); }} style={{
          width: "100%", padding: "16px", background: "linear-gradient(135deg, #e87a7a, #d45a5a)",
          border: "none", borderRadius: "8px", color: "#1a1714", fontSize: "15px", fontWeight: 700,
          cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "32px",
        }}>+ Log Session</button>

        {/* Recent Sessions */}
        <div>
          <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "2px", color: "rgba(240,235,227,0.3)", marginBottom: "12px", fontWeight: 600 }}>Recent Sessions</div>
          {sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(240,235,227,0.25)", fontSize: "14px", border: "1px dashed rgba(240,235,227,0.1)", borderRadius: "8px" }}>
              No sessions yet. Get on the wall.
            </div>
          ) : (
            [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20).map((session) => {
              const validRuns = session.runs?.filter((r) => parseFloat(r.time) > 0 && r.topped && !r.warmup) || [];
              const bestInSession = validRuns.length ? Math.min(...validRuns.map((r) => parseFloat(r.time))) : null;
              const runCount = session.runs?.filter((r) => !r.warmup).length || 0;
              const isExpanded = expandedSession === session.id;

              return (
                <div key={session.id} style={{ marginBottom: "8px" }}>
                  <div onClick={() => setExpandedSession(isExpanded ? null : session.id)} style={{
                    background: "rgba(240,235,227,0.03)", border: "1px solid rgba(240,235,227,0.07)",
                    borderRadius: isExpanded ? "8px 8px 0 0" : "8px", padding: "14px 16px",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: "12px",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "14px", color: "#f0ebe3", fontWeight: 600 }}>
                          {new Date(session.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        {session.gymName && <span style={{ fontSize: "11px", color: "rgba(240,235,227,0.35)" }}>· {session.gymName}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "rgba(240,235,227,0.4)", fontFamily: "'DM Mono', monospace" }}>{runCount} runs</span>
                        {bestInSession && <TimeChip time={bestInSession} pb={pb} small />}
                        <span style={{ fontSize: "12px", color: "rgba(240,235,227,0.3)" }}>{session.duration}min</span>
                      </div>
                    </div>
                    <div style={{ color: "rgba(240,235,227,0.25)", fontSize: "18px", transform: isExpanded ? "rotate(180deg)" : "", transition: "transform 0.2s" }}>▾</div>
                  </div>

                  {isExpanded && (
                    <div style={{
                      background: "rgba(240,235,227,0.02)", border: "1px solid rgba(240,235,227,0.07)",
                      borderTop: "none", borderRadius: "0 0 8px 8px", padding: "16px",
                    }}>
                      <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
                        <div style={{ fontSize: "12px", color: "rgba(240,235,227,0.4)" }}>Energy: <span style={{ color: "#e87a7a" }}>{ENERGY_LEVELS[session.energyBefore]} → {ENERGY_LEVELS[session.energyAfter]}</span></div>
                        <div style={{ fontSize: "12px", color: "rgba(240,235,227,0.4)" }}>Grip: <span style={{ color: "#e87a7a" }}>{GRIP_FEEL[session.gripFeel]}</span></div>
                        <div style={{ fontSize: "12px", color: "rgba(240,235,227,0.4)" }}>Psych: <span style={{ color: "#e87a7a" }}>{"★".repeat(session.psychLevel || 3)}{"☆".repeat(5 - (session.psychLevel || 3))}</span></div>
                      </div>

                      {session.focusAreas?.length > 0 && (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
                          {session.focusAreas.map((f) => (
                            <span key={f} style={{ padding: "2px 8px", background: "rgba(232,122,122,0.1)", border: "1px solid rgba(232,122,122,0.2)", borderRadius: "4px", fontSize: "10px", color: "#e87a7a" }}>{f}</span>
                          ))}
                        </div>
                      )}

                      {session.runs?.length > 0 && (
                        <div style={{ marginBottom: "12px" }}>
                          {session.runs.map((r, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "center", gap: "8px", padding: "6px 0",
                              borderBottom: i < session.runs.length - 1 ? "1px solid rgba(240,235,227,0.05)" : "none",
                            }}>
                              <span style={{ fontSize: "11px", color: "rgba(240,235,227,0.25)", fontFamily: "'DM Mono', monospace", minWidth: "20px" }}>
                                {r.warmup ? "W" : `#${i + 1 - (session.runs.slice(0, i).filter(x => x.warmup).length)}`}
                              </span>
                              {r.time ? <TimeChip time={r.time} pb={pb} small /> : <span style={{ fontSize: "12px", color: "rgba(240,235,227,0.25)" }}>no time</span>}
                              {r.falseStart && <span style={{ fontSize: "10px", color: "#e87a7a", background: "rgba(232,122,122,0.1)", padding: "1px 6px", borderRadius: "3px" }}>FS</span>}
                              {r.fall && <span style={{ fontSize: "10px", color: "#e8aa7a", background: "rgba(232,170,122,0.1)", padding: "1px 6px", borderRadius: "3px" }}>FALL</span>}
                              {!r.topped && <span style={{ fontSize: "10px", color: "rgba(240,235,227,0.3)", background: "rgba(240,235,227,0.05)", padding: "1px 6px", borderRadius: "3px" }}>DNF</span>}
                              {r.splitBottom && <span style={{ fontSize: "10px", color: "rgba(240,235,227,0.3)" }}>bot:{r.splitBottom}s</span>}
                              {r.splitTop && <span style={{ fontSize: "10px", color: "rgba(240,235,227,0.3)" }}>top:{r.splitTop}s</span>}
                              {r.notes && <span style={{ fontSize: "10px", color: "rgba(240,235,227,0.2)", fontStyle: "italic", flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {session.notes && <div style={{ fontSize: "12px", color: "rgba(240,235,227,0.35)", fontStyle: "italic", marginBottom: "12px" }}>"{session.notes}"</div>}

                      <button onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Delete this session?")) { persist(sessions.filter((s) => s.id !== session.id)); setExpandedSession(null); }
                      }} style={{
                        padding: "6px 12px", background: "rgba(200,80,80,0.1)", border: "1px solid rgba(200,80,80,0.2)",
                        borderRadius: "4px", color: "rgba(200,80,80,0.6)", fontSize: "11px", cursor: "pointer", fontFamily: "'DM Mono', monospace",
                      }}>Delete Session</button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ── Log Session ──
  const renderLog = () => {
    if (!currentSession) return null;
    const s = currentSession;

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
          <button onClick={() => setView("dashboard")} style={backBtnStyle}>←</button>
          <h2 style={{ ...headingStyle, margin: 0 }}>Log Session</h2>
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Date</label>
            <input type="date" value={s.date} onChange={(e) => setCurrentSession({ ...s, date: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Gym</label>
            <input type="text" placeholder="Gym name..." value={s.gymName} onChange={(e) => setCurrentSession({ ...s, gymName: e.target.value })} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Duration (min)</label>
          <input type="number" value={s.duration} onChange={(e) => setCurrentSession({ ...s, duration: parseInt(e.target.value) || 0 })} style={{ ...inputStyle, width: "100px" }} />
        </div>

        <SliderInput label="Energy Before" value={s.energyBefore} onChange={(v) => setCurrentSession({ ...s, energyBefore: v })} labels={ENERGY_LEVELS} max={4} />
        <SliderInput label="Grip Feel" value={s.gripFeel} onChange={(v) => setCurrentSession({ ...s, gripFeel: v })} labels={GRIP_FEEL} max={4} />

        {/* Psych */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Psych Level</label>
          <div style={{ display: "flex", gap: "6px" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setCurrentSession({ ...s, psychLevel: n })} style={{
                width: "36px", height: "36px",
                background: n <= s.psychLevel ? "rgba(232,122,122,0.2)" : "rgba(240,235,227,0.04)",
                border: n <= s.psychLevel ? "1px solid rgba(232,122,122,0.4)" : "1px solid rgba(240,235,227,0.08)",
                borderRadius: "50%", color: n <= s.psychLevel ? "#e87a7a" : "rgba(240,235,227,0.2)", fontSize: "16px", cursor: "pointer",
              }}>★</button>
            ))}
          </div>
        </div>

        {/* Focus Areas */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Focus Areas</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {FOCUS_AREAS.map((f) => {
              const active = s.focusAreas.includes(f);
              return (
                <button key={f} onClick={() => {
                  const fa = active ? s.focusAreas.filter((x) => x !== f) : [...s.focusAreas, f];
                  setCurrentSession({ ...s, focusAreas: fa });
                }} style={{
                  padding: "6px 12px",
                  background: active ? "rgba(232,122,122,0.15)" : "rgba(240,235,227,0.04)",
                  border: active ? "1px solid rgba(232,122,122,0.35)" : "1px solid rgba(240,235,227,0.08)",
                  borderRadius: "4px", color: active ? "#e87a7a" : "rgba(240,235,227,0.3)",
                  fontSize: "11px", cursor: "pointer",
                }}>{f}</button>
              );
            })}
          </div>
        </div>

        {/* Runs */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Runs ({s.runs.filter(r => !r.warmup).length}){s.runs.filter(r => r.warmup).length > 0 && ` + ${s.runs.filter(r => r.warmup).length} warmup`}</label>
            <button onClick={() => setEditingRun(defaultRun())} style={{
              padding: "6px 14px", background: "rgba(232,122,122,0.15)", border: "1px solid rgba(232,122,122,0.3)",
              borderRadius: "4px", color: "#e87a7a", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Mono', monospace",
            }}>+ Add Run</button>
          </div>

          {s.runs.map((r, i) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px",
              background: "rgba(240,235,227,0.03)", border: "1px solid rgba(240,235,227,0.06)",
              borderRadius: "6px", marginBottom: "6px", cursor: "pointer",
            }} onClick={() => setEditingRun({ ...r, _index: i })}>
              <span style={{ fontSize: "11px", color: "rgba(240,235,227,0.25)", fontFamily: "'DM Mono', monospace", minWidth: "20px" }}>
                {r.warmup ? "W" : `#${i + 1 - s.runs.slice(0, i).filter(x => x.warmup).length}`}
              </span>
              {r.time ? <TimeChip time={r.time} pb={pb} small /> : <span style={{ fontSize: "12px", color: "rgba(240,235,227,0.3)" }}>—</span>}
              {r.falseStart && <span style={{ fontSize: "10px", color: "#e87a7a" }}>FS</span>}
              {r.fall && <span style={{ fontSize: "10px", color: "#e8aa7a" }}>FALL</span>}
              {!r.topped && <span style={{ fontSize: "10px", color: "rgba(240,235,227,0.3)" }}>DNF</span>}
              <div style={{ flex: 1 }} />
              <button onClick={(e) => {
                e.stopPropagation();
                setCurrentSession({ ...s, runs: s.runs.filter((_, j) => j !== i) });
              }} style={{ background: "none", border: "none", color: "rgba(200,80,80,0.5)", cursor: "pointer", fontSize: "14px" }}>✕</button>
            </div>
          ))}
        </div>

        <SliderInput label="Energy After" value={s.energyAfter} onChange={(v) => setCurrentSession({ ...s, energyAfter: v })} labels={ENERGY_LEVELS} max={4} />

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Session Notes</label>
          <textarea placeholder="How did it feel? What clicked? What was off..." value={s.notes} onChange={(e) => setCurrentSession({ ...s, notes: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={labelStyle}>Goals for Next Session</label>
          <textarea placeholder="What to focus on next time..." value={s.nextSessionGoals} onChange={(e) => setCurrentSession({ ...s, nextSessionGoals: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <button onClick={() => {
          const newSessions = [...sessions.filter((x) => x.id !== s.id), s];
          persist(newSessions);
          setCurrentSession(null);
          setView("dashboard");
        }} style={{
          width: "100%", padding: "16px", background: "linear-gradient(135deg, #7ac87a, #5ab85a)",
          border: "none", borderRadius: "8px", color: "#1a1714", fontSize: "15px", fontWeight: 700,
          cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: "1px", textTransform: "uppercase",
        }}>Save Session</button>
      </div>
    );
  };

  // ── Run Modal ──
  const renderRunModal = () => {
    if (!editingRun) return null;
    const r = editingRun;

    return (
      <div onClick={() => setEditingRun(null)} style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(10,9,8,0.85)",
        backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: "#1e1b17", border: "1px solid rgba(240,235,227,0.1)", borderRadius: "12px",
          padding: "24px", width: "100%", maxWidth: "400px", maxHeight: "80vh", overflow: "auto",
        }}>
          <h3 style={{ ...headingStyle, fontSize: "18px", marginBottom: "20px" }}>{r._index !== undefined ? "Edit Run" : "Log Run"}</h3>

          {/* Time */}
          <label style={labelStyle}>Time (seconds)</label>
          <input type="number" step="0.01" placeholder="e.g. 7.42" value={r.time}
            onChange={(e) => setEditingRun({ ...r, time: e.target.value })}
            style={{ ...inputStyle, fontSize: "24px", fontFamily: "'DM Mono', monospace", fontWeight: 700, textAlign: "center", marginBottom: "16px", color: "#e87a7a" }} />

          {/* Wall Height */}
          <label style={labelStyle}>Wall</label>
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
            {WALL_HEIGHTS.map((h) => (
              <button key={h} onClick={() => setEditingRun({ ...r, wallHeight: h })} style={{
                flex: 1, padding: "8px",
                background: r.wallHeight === h ? "rgba(232,122,122,0.2)" : "rgba(240,235,227,0.04)",
                border: r.wallHeight === h ? "1px solid rgba(232,122,122,0.4)" : "1px solid rgba(240,235,227,0.08)",
                borderRadius: "4px", color: r.wallHeight === h ? "#e87a7a" : "rgba(240,235,227,0.35)",
                fontSize: "12px", cursor: "pointer", fontFamily: "'DM Mono', monospace",
              }}>{h}</button>
            ))}
          </div>

          {/* Status Flags */}
          <label style={labelStyle}>Status</label>
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
            {[
              { key: "topped", label: "✓ Topped", activeColor: "#7ac87a", activeBg: "rgba(122,200,122,0.2)", activeBorder: "rgba(122,200,122,0.4)" },
              { key: "fall", label: "↓ Fall", activeColor: "#e8aa7a", activeBg: "rgba(232,170,122,0.2)", activeBorder: "rgba(232,170,122,0.4)" },
              { key: "falseStart", label: "⚡ False Start", activeColor: "#e87a7a", activeBg: "rgba(232,122,122,0.2)", activeBorder: "rgba(232,122,122,0.4)" },
              { key: "warmup", label: "🔥 Warmup", activeColor: "#e8c87a", activeBg: "rgba(232,200,122,0.2)", activeBorder: "rgba(232,200,122,0.4)" },
            ].map((flag) => (
              <button key={flag.key} onClick={() => setEditingRun({ ...r, [flag.key]: !r[flag.key] })} style={{
                flex: "1 1 45%", padding: "10px",
                background: r[flag.key] ? flag.activeBg : "rgba(240,235,227,0.04)",
                border: r[flag.key] ? `1px solid ${flag.activeBorder}` : "1px solid rgba(240,235,227,0.08)",
                borderRadius: "6px", color: r[flag.key] ? flag.activeColor : "rgba(240,235,227,0.35)",
                fontSize: "12px", cursor: "pointer", fontWeight: 600,
              }}>{flag.label}</button>
            ))}
          </div>

          {/* Splits */}
          <label style={labelStyle}>Splits (optional)</label>
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <div style={{ flex: 1 }}>
              <input type="number" step="0.01" placeholder="Bottom half"
                value={r.splitBottom} onChange={(e) => setEditingRun({ ...r, splitBottom: e.target.value })}
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", textAlign: "center" }} />
              <div style={{ fontSize: "9px", color: "rgba(240,235,227,0.25)", textAlign: "center", marginTop: "4px" }}>BOTTOM</div>
            </div>
            <div style={{ flex: 1 }}>
              <input type="number" step="0.01" placeholder="Top half"
                value={r.splitTop} onChange={(e) => setEditingRun({ ...r, splitTop: e.target.value })}
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", textAlign: "center" }} />
              <div style={{ fontSize: "9px", color: "rgba(240,235,227,0.25)", textAlign: "center", marginTop: "4px" }}>TOP</div>
            </div>
          </div>

          {/* Notes */}
          <label style={labelStyle}>Run Notes</label>
          <textarea placeholder="What happened, technique notes..."
            value={r.notes} onChange={(e) => setEditingRun({ ...r, notes: e.target.value })}
            rows={2} style={{ ...inputStyle, resize: "vertical", marginBottom: "20px" }} />

          <button onClick={() => {
            const newRun = { ...r }; delete newRun._index;
            let newRuns;
            if (r._index !== undefined) { newRuns = [...currentSession.runs]; newRuns[r._index] = newRun; }
            else { newRuns = [...currentSession.runs, newRun]; }
            setCurrentSession({ ...currentSession, runs: newRuns });
            setEditingRun(null);
          }} style={{
            width: "100%", padding: "14px", background: "linear-gradient(135deg, #e87a7a, #d45a5a)",
            border: "none", borderRadius: "8px", color: "#1a1714", fontSize: "14px", fontWeight: 700,
            cursor: "pointer", fontFamily: "'DM Mono', monospace", letterSpacing: "1px", textTransform: "uppercase",
          }}>{r._index !== undefined ? "Update Run" : "Add Run"}</button>
        </div>
      </div>
    );
  };

  // ── Goals ──
  const renderGoals = () => {
    return (
      <div>
        <h2 style={{ ...headingStyle, marginBottom: "24px" }}>Goals & Training</h2>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Target Time (seconds)</label>
          <input type="number" step="0.01" placeholder="e.g. 6.50"
            value={goals.targetTime} onChange={(e) => persistGoals({ ...goals, targetTime: e.target.value })}
            style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", fontSize: "20px", fontWeight: 700, width: "140px", textAlign: "center", color: "#e87a7a" }} />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Sessions Per Week</label>
          <div style={{ display: "flex", gap: "6px" }}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} onClick={() => persistGoals({ ...goals, sessionsPerWeek: n })} style={{
                width: "40px", height: "40px",
                background: goals.sessionsPerWeek === n ? "rgba(232,122,122,0.25)" : "rgba(240,235,227,0.04)",
                border: goals.sessionsPerWeek === n ? "1px solid rgba(232,122,122,0.5)" : "1px solid rgba(240,235,227,0.08)",
                borderRadius: "6px", color: goals.sessionsPerWeek === n ? "#e87a7a" : "rgba(240,235,227,0.35)",
                fontSize: "16px", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: 700,
              }}>{n}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Competition</label>
          <input type="text" placeholder="Competition name..." value={goals.compName} onChange={(e) => persistGoals({ ...goals, compName: e.target.value })} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Comp Date</label>
          <input type="date" value={goals.compDate} onChange={(e) => persistGoals({ ...goals, compDate: e.target.value })} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Training Notes / Motivation</label>
          <textarea placeholder="Your why..." value={goals.notes} onChange={(e) => persistGoals({ ...goals, notes: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        {/* Time History Chart */}
        {sessions.length > 0 && (() => {
          const allTimes = [];
          [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((s) => {
            s.runs?.forEach((r) => {
              const t = parseFloat(r.time);
              if (t > 0 && r.topped && !r.warmup && !r.fall) {
                allTimes.push({ date: s.date, time: t });
              }
            });
          });
          if (!allTimes.length) return null;
          const maxT = Math.max(...allTimes.map((t) => t.time));
          const minT = Math.min(...allTimes.map((t) => t.time));
          const range = maxT - minT || 1;

          return (
            <div style={{ marginTop: "28px" }}>
              <label style={labelStyle}>Time Progression</label>
              <div style={{ height: "120px", display: "flex", alignItems: "flex-end", gap: "2px", marginTop: "8px" }}>
                {allTimes.slice(-40).map((t, i) => {
                  const heightPct = ((maxT - t.time) / range) * 80 + 15;
                  const isPB = t.time === pb;
                  return (
                    <div key={i} style={{
                      flex: 1, maxWidth: "12px", height: `${heightPct}%`,
                      background: isPB ? "#7ac87a" : `rgba(232,122,122,${0.3 + ((maxT - t.time) / range) * 0.5})`,
                      borderRadius: "2px 2px 0 0", minHeight: "4px", transition: "height 0.3s",
                    }} title={`${t.time}s — ${t.date}`} />
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                <span style={{ fontSize: "9px", color: "rgba(240,235,227,0.25)", fontFamily: "'DM Mono', monospace" }}>{allTimes.slice(-40)[0]?.date}</span>
                <span style={{ fontSize: "9px", color: "rgba(240,235,227,0.25)", fontFamily: "'DM Mono', monospace" }}>latest</span>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div style={rootStyle}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ flex: 1, overflow: "auto", padding: "24px 20px 100px" }}>
        {view === "dashboard" && renderDashboard()}
        {view === "log" && renderLog()}
        {view === "goals" && renderGoals()}
      </div>
      {renderRunModal()}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, display: "flex",
        background: "rgba(26,23,20,0.95)", backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(240,235,227,0.08)", zIndex: 50,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {[
          { id: "dashboard", label: "Home", icon: "◈" },
          { id: "log", label: "Log", icon: "+" },
          { id: "goals", label: "Goals", icon: "◎" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => {
            if (tab.id === "log" && !currentSession) setCurrentSession(defaultSession());
            setView(tab.id);
          }} style={{
            flex: 1, padding: "12px 0 14px", background: "none", border: "none",
            color: view === tab.id ? "#e87a7a" : "rgba(240,235,227,0.3)", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
          }}>
            <span style={{ fontSize: "20px" }}>{tab.icon}</span>
            <span style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", fontFamily: "'DM Mono', monospace" }}>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const rootStyle = { minHeight: "100vh", background: "#1a1714", color: "#f0ebe3", fontFamily: "'DM Sans', sans-serif", position: "relative" };
const headingStyle = { fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 700, color: "#f0ebe3" };
const labelStyle = { display: "block", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(240,235,227,0.4)", marginBottom: "8px", fontWeight: 600 };
const inputStyle = { width: "100%", padding: "10px 12px", background: "rgba(240,235,227,0.04)", border: "1px solid rgba(240,235,227,0.1)", borderRadius: "6px", color: "#f0ebe3", fontSize: "14px", fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" };
const backBtnStyle = { width: "36px", height: "36px", background: "rgba(240,235,227,0.06)", border: "1px solid rgba(240,235,227,0.1)", borderRadius: "8px", color: "#f0ebe3", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

export default App;
