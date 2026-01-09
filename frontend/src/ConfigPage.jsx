import { useState } from "react";
import DnDIconPlan from "./DnDIconPlan";

const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const meals = ["Morgens", "Mittags", "Abends"];

export default function ConfigPage({ onSave, config, isAuthenticated, onLogin, onBack }) {
      // Geburtstage State und Popup
      const [showBirthdayPopup, setShowBirthdayPopup] = useState(false);
      const [birthdayEditIdx, setBirthdayEditIdx] = useState(null);
      const [birthdayName, setBirthdayName] = useState("");
      const [birthdayDate, setBirthdayDate] = useState("");
      // Geburtstage initialisieren, falls nicht vorhanden
      if (!localConfig.birthdays) localConfig.birthdays = [];

      function openBirthdayPopup(idx = null) {
        setBirthdayEditIdx(idx);
        if (idx !== null) {
          setBirthdayName(localConfig.birthdays[idx].name);
          setBirthdayDate(localConfig.birthdays[idx].date);
        } else {
          setBirthdayName("");
          setBirthdayDate("");
        }
        setShowBirthdayPopup(true);
      }
      function saveBirthday() {
        const arr = [...localConfig.birthdays];
        if (birthdayEditIdx !== null) {
          arr[birthdayEditIdx] = { name: birthdayName, date: birthdayDate };
        } else {
          arr.push({ name: birthdayName, date: birthdayDate });
        }
        setLocalConfig({ ...localConfig, birthdays: arr });
        setShowBirthdayPopup(false);
      }
      function removeBirthday(idx) {
        const arr = [...localConfig.birthdays];
        arr.splice(idx, 1);
        setLocalConfig({ ...localConfig, birthdays: arr });
      }
      const renderBirthdayPopup = () => showBirthdayPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="p-6 rounded shadow-lg min-w-[300px]" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
            <h3 className="font-bold mb-2" style={{ color: 'var(--accent)' }}>Geburtstag {birthdayEditIdx !== null ? 'bearbeiten' : 'hinzufügen'}</h3>
            <label className="block mb-1">Name:</label>
            <input className="border p-1 w-full mb-2" value={birthdayName} onChange={e => setBirthdayName(e.target.value)} placeholder="Name" style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }} />
            <label className="block mb-1">Geburtstag:</label>
            <input className="border p-1 w-full mb-2" type="date" value={birthdayDate} onChange={e => setBirthdayDate(e.target.value)} style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }} />
            <div className="flex justify-end gap-2 mt-2">
              {birthdayEditIdx !== null && <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={() => { removeBirthday(birthdayEditIdx); setShowBirthdayPopup(false); }}>Löschen</button>}
              <button className="px-3 py-1 rounded" style={{ background: 'var(--accent2)', color: 'var(--accent)' }} onClick={() => setShowBirthdayPopup(false)}>Abbrechen</button>
              <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={saveBirthday}>Speichern</button>
            </div>
          </div>
        </div>
      );
    // --- Essensplan-Popup-Logik ---
    const [mealplanEdit, setMealplanEdit] = useState(null);
    function handleMealplanObjChange(dayIdx, mealIdx, field, value) {
      const newPlan = localConfig.mealplan ? localConfig.mealplan.map(row => [...row]) : Array(7).fill(0).map(() => Array(3).fill(""));
      let meal = newPlan[dayIdx][mealIdx];
      if (!meal || typeof meal === "string") meal = { name: meal || "", link: "" };
      meal = { ...meal, [field]: value };
      newPlan[dayIdx][mealIdx] = meal;
      setLocalConfig({ ...localConfig, mealplan: newPlan });
    }
    function handleMealplanEditClose() {
      setMealplanEdit(null);
    }
    }
    function renderMealplanEditPopup() {
      if (!mealplanEdit) return null;
      const { dayIdx, mealIdx } = mealplanEdit;
      const meal = localConfig.mealplan && localConfig.mealplan[dayIdx] ? localConfig.mealplan[dayIdx][mealIdx] : { name: "", link: "" };
      const val = typeof meal === "string" ? { name: meal, link: "" } : meal;
      return (
        <>
          <div className="mb-4">
            <button className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-600" onClick={() => openBirthdayPopup()}>Geburtstage</button>
            {localConfig.birthdays.length > 0 && (
              <div className="mt-2">
                <div className="font-semibold mb-1">Alle Geburtstage:</div>
                <ul>
                  {localConfig.birthdays.map((b, i) => (
                    <li key={i} className="flex gap-2 items-center mb-1">
                      <span>{b.name} ({b.date})</span>
                      <button className="text-accent px-2" onClick={() => openBirthdayPopup(i)}>Bearbeiten</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {renderBirthdayPopup()}
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
            <div
              className="p-6 rounded shadow-lg min-w-[300px]"
              style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
            >
              <h3 className="font-bold mb-2" style={{ color: 'var(--accent)' }}>
                Rezept für {days[dayIdx]}, {meals[mealIdx]}
              </h3>
              <label className="block mb-1">Name:</label>
              <input
                className="border p-1 w-full mb-2"
                value={val.name}
                onChange={e => handleMealplanObjChange(dayIdx, mealIdx, "name", e.target.value)}
                placeholder="Gericht"
                style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
              />
              <label className="block mb-1">Rezept-Link:</label>
              <input
                className="border p-1 w-full mb-2"
                value={val.link}
                onChange={e => handleMealplanObjChange(dayIdx, mealIdx, "link", e.target.value)}
                placeholder="https://..."
                style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button className="px-3 py-1 rounded" style={{ background: 'var(--accent2)', color: 'var(--accent)' }} onClick={handleMealplanEditClose}>Schließen</button>
              </div>
            </div>
          </div>
        </>
      );
    }
  const [localConfig, setLocalConfig] = useState(config || {
    family: [],
    todos: [],
    mealplan: Array(7).fill(0).map(() => Array(3).fill({ name: "", link: "" })),
    termine: Array(7).fill(0).map(() => []),
    standardItems: [
      { name: "Küche putzen", icon: "🧽" },
      { name: "Bad putzen", icon: "🛁" },
      { name: "Flur putzen", icon: "🧹" },
      { name: "Turnen", icon: "🤸" },
      { name: "Büro", icon: "💻" }
    ],
    // [day][person] = [iconIdx, ...]
    standardItemPersonPlan: Array(7).fill(0).map(() => []),
    refreshInterval: 15,
  });
        {/* Auto-Refresh-Intervall */}
        <div className="mb-4">
          <label className="font-semibold block mb-2">Auto-Refresh-Intervall:</label>
          <select
            className="border p-1 rounded"
            value={localConfig.refreshInterval ?? 15}
            onChange={e => setLocalConfig({ ...localConfig, refreshInterval: Number(e.target.value) })}
          >
            <option value={0}>Aus</option>
            <option value={5}>5 Sekunden</option>
            <option value={10}>10 Sekunden</option>
            <option value={15}>15 Sekunden</option>
            <option value={30}>30 Sekunden</option>
            <option value={60}>60 Sekunden</option>
          </select>
        </div>
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-10 card">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--accent)' }}>Login zur Konfiguration</h2>
        <input
          type="password"
          className="border p-2 w-full mb-2"
          placeholder="Passwort"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {loginError && <div className="text-red-400 mb-2">{loginError}</div>}
        <button
          className="w-full px-4 py-2 mt-2"
          onClick={() => {
            if (onLogin(password)) setLoginError("");
            else setLoginError("Falsches Passwort!");
          }}
        >
          Login
        </button>
      </div>
    );
  }

  function handleChange(field, value) {
    setLocalConfig({ ...localConfig, [field]: value });
  }

  function handleArrayChange(field, idx, value) {
    const arr = [...localConfig[field]];
    arr[idx] = value;
    setLocalConfig({ ...localConfig, [field]: arr });
  }

  function handleAdd(field) {
    setLocalConfig({ ...localConfig, [field]: [...localConfig[field], ""] });
  }

  function handleRemove(field, idx) {
    const arr = [...localConfig[field]];
    arr.splice(idx, 1);
    setLocalConfig({ ...localConfig, [field]: arr });
  }

  function handleMealplanChange(dayIdx, mealIdx, value) {
    const newPlan = localConfig.mealplan ? localConfig.mealplan.map(row => [...row]) : Array(7).fill(0).map(() => Array(3).fill(""));
    newPlan[dayIdx][mealIdx] = value;
    setLocalConfig({ ...localConfig, mealplan: newPlan });
  }

  function handleTermineChange(dayIdx, memberIdx, value) {
    const newTermine = localConfig.termine ? localConfig.termine.map(row => [...row]) : Array(7).fill(0).map(() => []);
    if (!newTermine[dayIdx]) newTermine[dayIdx] = [];
    newTermine[dayIdx][memberIdx] = value;
    setLocalConfig({ ...localConfig, termine: newTermine });
  }

  function handleStandardItemChange(idx, value) {
    const arr = [...localConfig.standardItems];
    arr[idx] = { ...arr[idx], icon: value };
    setLocalConfig({ ...localConfig, standardItems: arr });
  }

  // Emoji-Palette für Icon-Auswahl (erweitert für Räume, Haushalt, Büro, Sport, Musik, etc.)
  const emojiPalette = [
    // Räume
    "🏠", // Haus
    "🚪", // Tür/Flur
    "🛋️", // Wohnzimmer
    "🍽️", // Esszimmer
    "🍳", // Küche
    "🛏️", // Schlafzimmer
    "🧸", // Kinderzimmer
    "🚿", // Bad/Dusche
    "🚽", // Toilette
    "🧺", // Waschküche
    "🧑‍🔬", // Arbeitszimmer/Büro
    "🧑‍🎨", // Bastelzimmer
    "🧑‍🍳", // Vorratsraum
    "🪑", // Stuhl/Möbel
    "🖼️", // Bild
    "🪟", // Fenster
    "🪞", // Spiegel
    "🗄️", // Schrank
    "🗃️", // Schublade
    "🗑️", // Mülleimer
    // Kindergarten & Spielgruppe
    "🎒", // Kindergarten
    "🧩", // Spielgruppe
    // Haushalt
    "🧼", "🧴", "🧺", "🧻", "🧯", "🧲", "🧪", "🧑‍🍳", "🍳", "🥣", "🍽️", "🧂", "🧊", "�", "�", "🧁",
    // Büro
    "💻", "🖥️", "🖨️", "🗂️", "📁", "📂", "📅", "📆", "📋", "📎", "🖇️", "📌", "📍", "📝", "✏️", "🖊️", "🖋️", "🖌️", "🖍️", "📐", "📏", "📊", "📈", "📉",
    // Sport
    "🤸", "🏊", "�", "🚴", "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏓", "🏸", "🥅", "⛳", "🏒", "🏑", "🏏", "🥍", "🏹", "🥊", "🥋", "⛸️", "🎿", "🏂", "🛷", "🛹",
    // Musik & Freizeit
    "�🎸", "🎹", "🥁", "�", "�", "🎻", "🎤", "🎧", "🎼", "🎮", "🎲", "�", "🎯", "�", "🪁", "�", "�",
    // Sonstiges
    "🚗", "🛒", "🧑‍🎓", "🧑‍🔧", "🧑‍🎤", "🧑‍🚀", "📚", "🎨", "🖼️"
  ];

  // Für Emoji-Picker Dropdown
  const [openPickerIdx, setOpenPickerIdx] = useState(null);

  function handleAddStandardItem() {
    setLocalConfig({ ...localConfig, standardItems: [...localConfig.standardItems, { name: "", icon: "" }] });
  }

  function handleRemoveStandardItem(idx) {
    const arr = [...localConfig.standardItems];
    arr.splice(idx, 1);
    setLocalConfig({ ...localConfig, standardItems: arr });
    // Entferne das Item aus allen Personen+Tagen im Plan
    const newPlan = (localConfig.standardItemPersonPlan || Array(7).fill(0).map(() => []))
      .map(dayArr => dayArr.map(personArr => (personArr || []).filter(i => i !== idx)));
    setLocalConfig(lc => ({ ...lc, standardItemPersonPlan: newPlan }));
  }

  // [day][person] = [itemIdx, ...]
  function handleStandardItemPersonPlanChange(dayIdx, personIdx, itemIdx, checked) {
    let plan = localConfig.standardItemPersonPlan ? localConfig.standardItemPersonPlan.map(day => day.map(arr => [...(arr || [])])) : Array(7).fill(0).map(() => []);
    // Ensure structure
    while (plan.length < 7) plan.push([]);
    if (!plan[dayIdx]) plan[dayIdx] = [];
    while (plan[dayIdx].length < localConfig.family.length) plan[dayIdx].push([]);
    if (!plan[dayIdx][personIdx]) plan[dayIdx][personIdx] = [];
    if (checked) {
      if (!plan[dayIdx][personIdx].includes(itemIdx)) plan[dayIdx][personIdx].push(itemIdx);
    } else {
      plan[dayIdx][personIdx] = plan[dayIdx][personIdx].filter(i => i !== itemIdx);
    }
    setLocalConfig({ ...localConfig, standardItemPersonPlan: plan });
  }

  function handleStandardItemPlanChange(dayIdx, itemIdx, checked) {
    const plan = localConfig.standardItemPlan ? localConfig.standardItemPlan.map(arr => [...arr]) : Array(7).fill(0).map(() => []);
    if (checked) {
      if (!plan[dayIdx].includes(itemIdx)) plan[dayIdx].push(itemIdx);
    } else {
      plan[dayIdx] = plan[dayIdx].filter(i => i !== itemIdx);
    }
    setLocalConfig({ ...localConfig, standardItemPlan: plan });
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 card">
      <button
        className="mb-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
        onClick={onBack}
      >
        ← Zurück zum Dashboard
      </button>
  <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--accent)' }}>Konfiguration</h2>
      {/* Familienmitglieder */}
      <div className="mb-4">
        <label className="font-semibold">Familienmitglieder:</label>
        {localConfig.family.map((m, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <input
              className="border p-1 flex-1"
              value={m}
              onChange={e => handleArrayChange("family", i, e.target.value)}
            />
            <button className="text-red-400 px-2" onClick={() => handleRemove("family", i)}>-</button>
          </div>
        ))}
        <button className="text-accent px-2 mt-1" onClick={() => handleAdd("family")}>+ Mitglied</button>
      </div>
      {/* To-dos */}
      <div className="mb-4">
        <label className="font-semibold">To-dos (Vorlagen):</label>
        {localConfig.todos.map((t, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <input
              className="border p-1 flex-1"
              value={typeof t === 'object' && t !== null ? t.text : t}
              onChange={e => {
                const arr = [...localConfig.todos];
                if (typeof arr[i] === 'object' && arr[i] !== null) {
                  arr[i] = { ...arr[i], text: e.target.value };
                } else {
                  arr[i] = e.target.value;
                }
                setLocalConfig({ ...localConfig, todos: arr });
              }}
            />
            <button className="text-red-400 px-2" onClick={() => handleRemove("todos", i)}>-</button>
          </div>
        ))}
        <button className="text-accent px-2 mt-1" onClick={() => handleAdd("todos")}>+ To-do</button>
      </div>
      {/* Standard-Items: Name + Icon */}
      <div className="mb-4">
        <label className="font-semibold block mb-2">Standard-Icons:</label>
        {localConfig.standardItems.map((item, i) => (
          <div key={i} className="flex gap-2 mb-1 items-center">
            <input
              className="border p-1 flex-1"
              value={item.name}
              onChange={e => {
                const arr = [...localConfig.standardItems];
                arr[i] = { ...arr[i], name: e.target.value };
                setLocalConfig({ ...localConfig, standardItems: arr });
              }}
              placeholder="Name"
            />
            <div className="relative">
              <input
                className="border p-1 w-16 text-center"
                value={item.icon}
                onChange={e => handleStandardItemChange(i, e.target.value)}
                placeholder="Icon"
                maxLength={2}
                style={{ cursor: 'pointer' }}
                onFocus={() => setOpenPickerIdx(i)}
                onBlur={() => setTimeout(() => setOpenPickerIdx(null), 150)}
                readOnly
              />
              {openPickerIdx === i && (
                <div className="absolute z-20 bg-white dark:bg-gray-800 border rounded shadow p-1 mt-1 flex flex-wrap gap-1 max-h-40 overflow-y-auto" style={{ minWidth: '220px' }}>
                  {emojiPalette.map(emoji => (
                    <button
                      type="button"
                      key={emoji}
                      className="text-lg hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-1"
                      style={{ lineHeight: 1 }}
                      tabIndex={-1}
                      onClick={() => { handleStandardItemChange(i, emoji); setOpenPickerIdx(null); }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="text-red-400 px-2" onClick={() => handleRemoveStandardItem(i)}>-</button>
          </div>
        ))}
        <button className="text-accent px-2 mt-1" onClick={handleAddStandardItem}>+ Icon</button>
      </div>
      {/* Drag-and-Drop Wochenplan */}
      <div className="mb-4">
        <label className="font-semibold block mb-2">Icons per Drag & Drop in den Wochenplan ziehen:</label>
        <DnDIconPlan
          icons={localConfig.standardItems}
          plan={localConfig.standardItemPersonPlan}
          family={localConfig.family}
          days={days}
          onDrop={(dayIdx, personIdx, iconIdx) => {
            // Füge Icon in die Zelle ein (mehrfach möglich)
            const plan = localConfig.standardItemPersonPlan ? localConfig.standardItemPersonPlan.map(day => day.map(arr => [...(arr || [])])) : Array(7).fill(0).map(() => []);
            while (plan.length < 7) plan.push([]);
            if (!plan[dayIdx]) plan[dayIdx] = [];
            while (plan[dayIdx].length < localConfig.family.length) plan[dayIdx].push([]);
            if (!plan[dayIdx][personIdx]) plan[dayIdx][personIdx] = [];
            plan[dayIdx][personIdx].push(iconIdx);
            setLocalConfig({ ...localConfig, standardItemPersonPlan: plan });
          }}
          onRemove={(dayIdx, personIdx, iconArrIdx) => {
            // Entferne Icon an Position iconArrIdx in der Zelle
            const plan = localConfig.standardItemPersonPlan ? localConfig.standardItemPersonPlan.map(day => day.map(arr => [...(arr || [])])) : Array(7).fill(0).map(() => []);
            if (plan[dayIdx] && plan[dayIdx][personIdx]) {
              plan[dayIdx][personIdx].splice(iconArrIdx, 1);
            }
            setLocalConfig({ ...localConfig, standardItemPersonPlan: plan });
          }}
        />
      </div>
      {/* Termine */}
      <div className="mb-4">
        <label className="font-semibold block mb-2">Termine:</label>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr>
                <th className="border p-1"> </th>
                {days.map((day, i) => (
                  <th key={i} className="border p-1">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localConfig.family.map((member, mIdx) => (
                <tr key={mIdx}>
                  <td className="border p-1 font-semibold">{member}</td>
                  {days.map((_, dIdx) => (
                    <td className="border p-1" key={dIdx}>
                      <input
                        className="border p-1 w-full"
                        value={localConfig.termine && localConfig.termine[dIdx] && localConfig.termine[dIdx][mIdx] ? localConfig.termine[dIdx][mIdx] : ""}
                        onChange={e => handleTermineChange(dIdx, mIdx, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Essensplan */}
      <div className="mb-4">
        <label className="font-semibold block mb-2">Essensplan:</label>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
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
                      <button
                        className="w-full text-left border p-1 bg-white hover:bg-gray-100 rounded"
                        type="button"
                        onClick={() => setMealplanEdit({ dayIdx, mealIdx })}
                      >
                        {(() => {
                          let meal = null;
                          if (localConfig.mealplan && localConfig.mealplan[dayIdx]) {
                            meal = localConfig.mealplan[dayIdx][mealIdx];
                          }
                          if (!meal) return "";
                          if (typeof meal === "string") return meal;
                          return meal.name || "";
                        })()}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* iCal-Link (anonymisiert, nicht kopierbar) */}
      <div className="mb-4">
        <label className="font-semibold block mb-2">Google Kalender iCal-Link (anonymisiert):</label>
        <input
          type="password"
          className="border p-1 w-full bg-gray-100 select-none"
          value={localConfig.calendarIcalUrl || ""}
          onChange={e => setLocalConfig({ ...localConfig, calendarIcalUrl: e.target.value })}
          autoComplete="new-password"
          spellCheck={false}
          readOnly={false}
          style={{ userSelect: 'none' }}
        />
        <div className="text-xs text-gray-500 mt-1">Der Link ist anonymisiert und kann nicht kopiert werden.</div>
      </div>

      {/* Auto-Refresh-Intervall ganz unten */}
      <div className="mb-4">
        <label className="font-semibold block mb-2">Auto-Refresh-Intervall:</label>
        <select
          className="border p-1 rounded"
          value={localConfig.refreshInterval ?? 15}
          onChange={e => setLocalConfig({ ...localConfig, refreshInterval: Number(e.target.value) })}
        >
          <option value={0}>Aus</option>
          <option value={5}>5 Sekunden</option>
          <option value={10}>10 Sekunden</option>
          <option value={15}>15 Sekunden</option>
          <option value={30}>30 Sekunden</option>
          <option value={60}>60 Sekunden</option>
        </select>
      </div>
      <button
        className="bg-green-600 text-white px-4 py-2 rounded mt-4"
        onClick={() => onSave(localConfig)}
      >
        Speichern
      </button>
    {renderMealplanEditPopup()}
    </div>
  );
}
