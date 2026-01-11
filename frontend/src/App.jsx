
import { useEffect, useState, useRef } from "react";
import ConfigPage from "./ConfigPage";
import { fetchDashboardConfig, saveDashboardConfig, fetchIcalEvents } from "./api";
import { fetchVersion } from "./versionApi";

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

  // Geburtstags-Newsbanner
  let todaysBirthdays = [];
  if (config && config.birthdays && Array.isArray(config.birthdays)) {
    const today = new Date();
    const todayStr = (today.getMonth() + 1).toString().padStart(2, '0') + '-' + today.getDate().toString().padStart(2, '0');
    todaysBirthdays = config.birthdays.filter(b => {
      if (!b.date) return false;
      // b.date im Format YYYY-MM-DD
      const [, month, day] = b.date.split('-');
      return (month + '-' + day) === todayStr;
    });
  }

  // Aktueller Wochentag-Index (0=Mo, 1=Di, ..., 6=So)
  const todayDayIdx = (() => {
    const dayOfWeek = new Date().getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  })();

  return (
    <>
      <div className="min-h-screen" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
        <nav className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center p-4 shadow" style={{ background: 'var(--accent2)', color: 'var(--accent)' }}>
          <div className="flex items-center gap-4">
            <span className="font-bold text-xl">Family Dashboard</span>
            {todaysBirthdays.length > 0 && (
              <div className="ml-4 px-8 py-3 rounded text-lg font-medium" style={{ background: 'var(--accent)', color: 'var(--bg-main)' }}>
                🎉 Heute hat Geburtstag: {todaysBirthdays.map(b => {
                  // Alter berechnen
                  if (!b.date) return b.name;
                  const birthYear = parseInt(b.date.split('-')[0], 10);
                  const today = new Date();
                  let age = today.getFullYear() - birthYear;
                  // Falls Geburtstag dieses Jahr noch nicht war, ein Jahr abziehen
                  const month = parseInt(b.date.split('-')[1], 10);
                  const day = parseInt(b.date.split('-')[2], 10);
                  if (
                    today.getMonth() + 1 < month ||
                    (today.getMonth() + 1 === month && today.getDate() < day)
                  ) {
                    age--;
                  }
                  return `${b.name} (${age})`;
                }).join(', ')} 🎉
              </div>
            )}
          </div>
          <button className="px-4 py-2" onClick={() => setRoute("config")}>Konfiguration</button>
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
                                <span key={itemIdx} title={item.name} className="inline-block text-lg align-middle" style={{ filter: 'drop-shadow(0 1px 2px #0002)' }}>{item.icon}</span>
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
                                  <span className="inline-block">📅</span>
                                  <span>{ev.summary}</span>
                                  {ev.start && (
                                    <span className="ml-1 text-gray-500">{ev.start}</span>
                                  )}
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
                                <span className="inline-block">📅</span>
                                <span>{ev.summary}</span>
                                {ev.start && (
                                  <span className="ml-1 text-gray-500">{ev.start}</span>
                                )}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--accent)' }}>🍽 Essensplan</h2>
              <div className="overflow-x-auto card">
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
            <div className="md:col-span-1">
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--accent)' }}>✅ To-dos</h2>
              <ul className="card text-base">
                {todos
                  .filter(t => {
                    if (!t.done || !t.doneAt) return true;
                    // Prüfe, ob erledigt vor mehr als 10 Tagen
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
            <div className="md:col-span-1">
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--accent)' }}>📝 Notizen</h2>
              <textarea
                ref={notesRef}
                className="w-full card p-2 text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none overflow-hidden"
                placeholder="Notizen hier eingeben..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ minHeight: 120, maxHeight: '60vh', background: 'var(--bg-main)', color: 'var(--text-main)' }}
              />
              <div className="text-xs text-gray-400 mt-1">Wird automatisch gespeichert</div>
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
