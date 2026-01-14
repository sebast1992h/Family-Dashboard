
import { useEffect, useState, useRef } from "react";
import ConfigPage from "./ConfigPage";
import { fetchDashboardConfig, saveDashboardConfig, fetchIcalEvents } from "./api";
import { fetchVersion } from "./versionApi";

// Hook to detect mobile viewport using matchMedia
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    setIsMobile(mq.matches);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, [breakpoint]);
  return isMobile;
}

function loadAuth() {
  return localStorage.getItem("dashboardAuth") === "1";
}
function saveAuth(val) {
  if (val) localStorage.setItem("dashboardAuth", "1");
  else localStorage.removeItem("dashboardAuth");
}


const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const meals = ["Morgens", "Mittags", "Abends"];


export default function App() {
  const [todos, setTodos] = useState([]);
  const [config, setConfig] = useState(null);
  const [route, setRoute] = useState("dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState(loadAuth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [icalEvents, setIcalEvents] = useState(Array(7).fill([]));
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const notesSaveTimeout = useRef(null);
  const notesRef = useRef(null);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    // update clock every minute (keeps hh:mm current)
    const tick = () => setCurrentTime(new Date());
    const id = setInterval(tick, 60 * 1000);
    // set immediately
    tick();
    return () => clearInterval(id);
  }, []);

  // Banner overflow handling for marquee scrolling
  const bannerOuterRef = useRef(null);
  const bannerInnerRef = useRef(null);
  const [bannerOverflowing, setBannerOverflowing] = useState(false);
  const [marqueeDuration, setMarqueeDuration] = useState(10);
  // Weather state
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);
  // Mobile detection
  const isMobile = useIsMobile(768);
  
  // Geburtstags-Newsbanner (berechnen, bevor Hooks später verwendet werden)
  let todaysBirthdays = [];
  if (config && config.birthdays && Array.isArray(config.birthdays)) {
    const today = new Date();
    const todayStr = (today.getMonth() + 1).toString().padStart(2, '0') + '-' + today.getDate().toString().padStart(2, '0');
    todaysBirthdays = config.birthdays.filter(b => {
      if (!b.date) return false;
      const [, month, day] = b.date.split('-');
      return (month + '-' + day) === todayStr;
    });
  }

  const birthdayText = todaysBirthdays.length > 0 ? todaysBirthdays.map(b => {
    if (!b.date) return b.name;
    const birthYear = parseInt(b.date.split('-')[0], 10);
    const today = new Date();
    let age = today.getFullYear() - birthYear;
    const month = parseInt(b.date.split('-')[1], 10);
    const day = parseInt(b.date.split('-')[2], 10);
    if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
      age--;
    }
    return `${b.name} (${age})`;
  }).join(', ') : null;

  // Compute upcoming birthdays within next 30 days (excluding today)
  let upcomingBirthdays = [];
  if (config && config.birthdays && Array.isArray(config.birthdays)) {
    const today = new Date();
    today.setHours(0,0,0,0);
    for (const b of config.birthdays) {
      if (!b.date) continue;
      const parts = b.date.split('-');
      if (parts.length < 3) continue;
      const birthYear = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      // next occurrence in this year
      let occ = new Date(today.getFullYear(), month - 1, day);
      occ.setHours(0,0,0,0);
      if (occ < today) {
        occ = new Date(today.getFullYear() + 1, month - 1, day);
        occ.setHours(0,0,0,0);
      }
      const diffDays = Math.round((occ - today) / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= 30) {
        const age = occ.getFullYear() - birthYear;
        upcomingBirthdays.push({ name: b.name, inDays: diffDays, age });
      }
    }
    upcomingBirthdays.sort((a,b) => a.inDays - b.inDays);
  }

  const upcomingText = (upcomingBirthdays && upcomingBirthdays.length > 0) ? upcomingBirthdays.map(u => {
    const when = u.inDays === 1 ? 'morgen' : `in ${u.inDays} Tagen`;
    return `${u.name} (${when})`;
  }).join(', ') : null;

  const currentTimeStr = currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
  // Banner overflow detection: placed before any early return so Hooks order is stable
  useEffect(() => {
    function check() {
      const outer = bannerOuterRef.current;
      const inner = bannerInnerRef.current;
      if (!outer || !inner) return;
      const overflowing = inner.scrollWidth > outer.clientWidth;
      setBannerOverflowing(overflowing);
      if (overflowing) {
        const ratio = inner.scrollWidth / outer.clientWidth;
        // slower scroll: increase multiplier and minimum duration
        const duration = Math.max(10, Math.round(ratio * 12));
        setMarqueeDuration(duration);
      }
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [currentTimeStr, birthdayText, upcomingText]);

  // Fetch weather (via backend proxy). Show nothing if error or missing data.
  useEffect(() => {
    let mounted = true;
    async function loadWeather() {
      try {
        const res = await fetch('/api/weather');
        if (!res.ok) {
          if (mounted) { setWeather(null); setWeatherError(true); }
          return;
        }
        const j = await res.json();
        // provider may return error details inside 'provider'
        if (j && typeof j.temp !== 'undefined' && j.temp !== null) {
          if (mounted) { setWeather(j); setWeatherError(false); }
        } else {
          if (mounted) { setWeather(null); setWeatherError(false); }
        }
      } catch (e) {
        if (mounted) { setWeather(null); setWeatherError(true); }
      }
    }
    loadWeather();
    const t = setInterval(loadWeather, 30 * 60 * 1000); // every 30 minutes
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // Auto-resize für Notizen-Textarea
  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = 'auto';
      notesRef.current.style.height = Math.min(notesRef.current.scrollHeight, window.innerHeight * 0.6) + 'px';
    }
  }, [notes]);

    // Version beim Start laden
    useEffect(() => {
      fetchVersion().then(setVersion);
    }, []);
  // Intervall aus config, fallback 15
  const refreshInterval = config && typeof config.refreshInterval === 'number' ? config.refreshInterval : 15;


  // Initiales Laden + Auto-Refresh
  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const cfg = await fetchDashboardConfig();
        if (!stopped) {
          setConfig(cfg);
          setTodos(cfg.todos);
          // Nur beim allerersten Laden die Notizen setzen!
          // Danach verwaltest du sie nur noch lokal über das Textfeld.
          if (loading) {
            setNotes(cfg.notes || "");
          }
          setLoading(false);
        }
        // iCal-Termine laden
        try {
          const events = await fetchIcalEvents();
          if (!stopped) setIcalEvents(events);
        } catch (e) {
          if (!stopped) setIcalEvents(Array(7).fill([]));
        }
      } catch (e) {
        if (!stopped) {
          setError("Fehler beim Laden der Dashboard-Daten");
          setLoading(false);
        }
      }
    }
    load();
    if (refreshInterval > 0) {
      const timer = setInterval(load, refreshInterval * 1000);
      return () => {
        stopped = true;
        clearInterval(timer);
      };
    }
    return () => { stopped = true; };
  }, [refreshInterval]);

  const hasInitialLoaded = useRef(false);
  const lastServerNotes = useRef("");
  useEffect(() => {
    if (config) {
      setTodos(config.todos);
      
      // Prüfe: Hat der Server einen ANDEREN Text als beim letzten Refresh?
      // UND: Ist dieser Server-Text anders als das, was ich gerade im Feld stehen habe?
      const serverNotes = config.notes || "";
      
      if (serverNotes !== lastServerNotes.current) {
        // Der Text auf dem Server hat sich seit dem letzten Laden geändert (z.B. durch PC B)
        setNotes(serverNotes);
        lastServerNotes.current = serverNotes;
      }
    }
  }, [config]);


  // Auto-save notes when changed (debounced)
  useEffect(() => {
    // 1. Nichts tun, wenn config noch nicht geladen ist
    if (!config) return;

    // 2. Nichts tun, wenn der Text im Feld exakt dem entspricht, was wir zuletzt vom Server wissen
    if (notes === lastServerNotes.current) return;

    // 3. Bestehenden Timer löschen (Debounce)
    if (notesSaveTimeout.current) {
      clearTimeout(notesSaveTimeout.current);
    }

    // 4. Neuen Timer setzen
    notesSaveTimeout.current = setTimeout(async () => {
      try {
        const updatedConfig = { ...config, notes };
        await saveDashboardConfig(updatedConfig);
        
        // WICHTIG: Nach dem Speichern merken wir uns diesen Stand als "aktuellen Server-Stand"
        lastServerNotes.current = notes;
        setConfig(updatedConfig); 
      } catch (e) {
        console.error("Fehler beim Speichern der Notizen", e);
      }
    }, 1000); // 1 Sekunde warten nach dem letzten Tastendruck

    return () => {
      if (notesSaveTimeout.current) clearTimeout(notesSaveTimeout.current);
    };
  }, [notes, config]);


  async function handleSave(newConfig) {
    setConfig(newConfig);
    setLoading(true);
    try {
      await saveDashboardConfig(newConfig);
      setConfig(newConfig);
      setRoute("dashboard");
    } catch (e) {
      setError("Fehler beim Speichern der Dashboard-Daten");
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(pw) {
    if (pw === "familie2025") {
      setIsAuthenticated(true);
      saveAuth(true);
      return true;
    }
    return false;
  }

  // Logout-Funktion (optional, z.B. für später)
  // function handleLogout() {
  //   setIsAuthenticated(false);
  //   saveAuth(false);
  //   setRoute("dashboard");
  // }


  if (loading) {
    return <div className="p-8 text-center">Lade Dashboard-Daten...</div>;
  }
  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }
  if (route === "config") {
    return <ConfigPage key={isAuthenticated ? "auth" : "noauth"} onSave={handleSave} config={config} isAuthenticated={isAuthenticated} onLogin={handleLogin} onBack={() => setRoute("dashboard")} />;
  }

  

  // Aktueller Wochentag-Index (0=Mo, 1=Di, ..., 6=So)
  const todayDayIdx = (() => {
    const dayOfWeek = new Date().getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  })();

  async function handleTodoToggle(idx) {
    const now = new Date().toISOString();
    const newTodos = todos.map((todo, i) => {
      if (i !== idx) return todo;
      if (!todo.done) {
        // Wird jetzt abgehakt: done true + doneAt setzen
        return { ...todo, done: true, doneAt: now };
      } else {
        // Wird wieder offen: done false + doneAt entfernen
        const t = { ...todo };
        delete t.doneAt;
        t.done = false;
        return t;
      }
    });
    const newConfig = { ...config, todos: newTodos };
    setTodos(newTodos);
    setConfig(newConfig);
    try {
      await saveDashboardConfig(newConfig);
    } catch (e) {
      setError("Fehler beim Speichern der To-dos");
    }
  }
  

  return (
    <>
      <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
        <nav className="flex items-center p-4 shadow" style={{ background: 'var(--accent2)', color: 'var(--accent)' }}>
          <div className="flex items-center gap-4">
            <span className="font-bold text-xl">Family Dashboard</span>
          </div>

          {!isMobile && (
            <div className="flex-1 mx-4" style={{ minWidth: 0 }}>
              <div ref={bannerOuterRef} className="w-full px-6 py-2 rounded text-lg font-medium overflow-hidden" style={{ background: 'var(--accent)', color: 'var(--bg-main)', whiteSpace: 'nowrap', position: 'relative', minWidth: 0, paddingRight: '12px', minHeight: '48px' }}>
              <style>{"@keyframes marquee{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}"}</style>
              <div
                ref={bannerInnerRef}
                className="flex items-center gap-4"
                style={bannerOverflowing ? { position: 'absolute', left: 0, top: 0, height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', animation: `${marqueeDuration}s linear infinite marquee` } : { display: 'inline-block', whiteSpace: 'nowrap' }}
              >
                <div className="text-lg font-medium" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginRight: '1rem' }}>
                  <span>Es ist {currentTimeStr} Uhr.</span>
                  {weather && !weatherError && (
                    <span style={{ marginLeft: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1 }}>
                      {weather.icon ? (
                        <img src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`} alt={weather.desc || 'Wetter'} style={{ height: '1em', width: '1em', display: 'inline-block', verticalAlign: 'middle' }} />
                      ) : null}
                      <span style={{ fontWeight: 600, lineHeight: 1 }}>{Math.round(weather.temp)}°C</span>
                      <span style={{ color: 'rgba(0,0,0,0.7)', lineHeight: 1 }}>{weather.desc}</span>
                    </span>
                  )}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', minWidth: '1px' }}>
                  {birthdayText
                    ? (`🎉 Heute hat Geburtstag: ${birthdayText} 🎉` + (upcomingText ? ` · 🎂 Anstehende Geburtstage: ${upcomingText}` : ''))
                    : (upcomingText ? `🎂 Anstehende Geburtstage: ${upcomingText}` : '')}
                </div>
              </div>
              </div>
            </div>
          )}

          <button className="px-4 py-2" style={{ flex: '0 0 auto', marginLeft: 12, zIndex: 60 }} onClick={() => setRoute("config")}>Konfiguration</button>
        </nav>

        <div className="p-4">
          <div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--accent)' }}>🗓 Termine</h2>
            <div className="overflow-x-auto mb-6 card">
              <table className="min-w-full border text-base">
                <thead>
                  <tr>
                    <th className="border p-1"> </th>
                    {days.map((day, i) => (
                      <th key={i} className="border p-1" style={i === todayDayIdx ? { background: 'rgba(74, 144, 217, 0.25)', fontWeight: 'bold' } : {}}>{day}</th>
                    ))}
                  </tr>
                  <tr>
                    <th className="border p-1"></th>
                    {(() => {
                      // Aktuelles Datum
                      const now = new Date();
                      // Tag der Woche (0=So, 1=Mo, ..., 6=Sa)
                      const dayOfWeek = now.getDay();
                      // Offset auf Montag (Mo=1, So=0)
                      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                      // Datum des Montags dieser Woche
                      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
                      // Für jeden Tag der Woche das Datum berechnen
                      return days.map((_, i) => {
                        const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
                        const dayStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        return <th key={i} className="border p-1 text-xs" style={i === todayDayIdx ? { background: 'rgba(74, 144, 217, 0.25)' } : { color: '#888' }}>{dayStr}</th>;
                      });
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {config.family.map((member, mIdx) => (
                    <tr key={mIdx}>
                      <td className="border p-1 font-semibold">{member}</td>
                      {days.map((_, dIdx) => (
                        <td className="border p-1" key={dIdx} style={dIdx === todayDayIdx ? { background: 'rgba(74, 144, 217, 0.08)' } : {}}>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {config.standardItemPersonPlan && config.standardItemPersonPlan[dIdx] && config.standardItemPersonPlan[dIdx][mIdx] && config.standardItemPersonPlan[dIdx][mIdx].map(itemIdx => {
                              const item = config.standardItems && config.standardItems[itemIdx];
                              if (!item) return null;
                              return (
                                <span key={itemIdx} title={item.name} className="inline-block align-middle" style={{ filter: 'drop-shadow(0 1px 2px #0002)', fontSize: '2em', lineHeight: 1 }}>{item.icon}</span>
                              );
                            })}
                          </div>
                          <div>
                            {config.termine && config.termine[dIdx] && config.termine[dIdx][mIdx] ? config.termine[dIdx][mIdx] : ""}
                          </div>
                          {/* iCal-Termine für dieses Familienmitglied */}
                          {icalEvents[dIdx] && icalEvents[dIdx][member] && icalEvents[dIdx][member].length > 0 && (
                            <div className="mt-1">
                              {icalEvents[dIdx][member].map((ev, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <span className="inline-block" style={{ fontSize: '1em', lineHeight: 1 }}>📅</span>
                                  <span>{ev.summary}{ev.start ? ` — ${ev.start}` : ''}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* iCal-Termine als eigene Zeile für nicht zugeordnete */}
                  <tr>
                    <td className="border p-1 font-semibold">Kalender</td>
                    {days.map((_, dIdx) => (
                      <td className="border p-1" key={dIdx} style={dIdx === todayDayIdx ? { background: 'rgba(74, 144, 217, 0.08)' } : {}}>
                        {icalEvents[dIdx] && icalEvents[dIdx]["Kalender"] && icalEvents[dIdx]["Kalender"].length > 0 && (
                          <div>
                            {icalEvents[dIdx]["Kalender"].map((ev, i) => (
                                <div key={i} className="flex items-center gap-1">
                                <span className="inline-block" style={{ fontSize: '1em', lineHeight: 1 }}>📅</span>
                                <span>{ev.summary}{ev.start ? ` — ${ev.start}` : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--accent)' }}>🍽 Essensplan</h2>
              <div className="overflow-x-auto card h-full">
                <table className="min-w-full border text-base">
                  <thead>
                    <tr>
                      <th className="border p-1"> </th>
                      {meals.map((meal, i) => (
                        <th key={i} className="border p-1">{meal}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((day, dayIdx) => (
                      <tr key={dayIdx}>
                        <td className="border p-1 font-semibold">{day}</td>
                        {meals.map((_, mealIdx) => (
                          <td className="border p-1" key={mealIdx}>
                            {(() => {
                              const meal = config.mealplan && config.mealplan[dayIdx] ? config.mealplan[dayIdx][mealIdx] : null;
                              if (!meal) return "";
                              if (typeof meal === "string") return meal;
                              if (meal.link) {
                                return <a href={meal.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{meal.name || meal.link}</a>;
                              }
                              return meal.name || "";
                            })()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 md:pr-2">
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--accent)' }}>✅ To-dos</h2>
                <ul className="card text-base h-full overflow-auto p-2">
                  {todos
                    .filter(t => {
                      if (!t.done || !t.doneAt) return true;
                      const doneDate = new Date(t.doneAt);
                      const now = new Date();
                      const diffDays = Math.floor((now - doneDate) / (1000 * 60 * 60 * 24));
                      return diffDays <= 10;
                    })
                    .map((t, i) => (
                      <li key={i} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={!!t.done}
                          onChange={() => handleTodoToggle(i)}
                          className="accent-green-600 w-5 h-5"
                        />
                        <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#888' : undefined }}>{typeof t === 'object' && t !== null ? t.text : t}</span>
                      </li>
                    ))}
                </ul>
              </div>

              <div className="flex-1 md:pl-2">
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--accent)' }}>📝 Notizen</h2>
                <textarea
                  ref={notesRef}
                  className="w-full card p-2 text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none overflow-hidden h-full"
                  placeholder="Notizen hier eingeben..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ minHeight: 120, background: 'var(--bg-main)', color: 'var(--text-main)' }}
                />
                <div className="text-xs text-gray-400 mt-1">Wird automatisch gespeichert</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "fixed", right: 12, bottom: 8, fontSize: "0.9em", color: "#888", zIndex: 50 }}>
        Version: {version}
      </div>
    </>
  );
}
