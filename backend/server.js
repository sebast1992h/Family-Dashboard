
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import ical from "ical";
import fetch from "node-fetch";
// import sqlite3 from "sqlite3";
// import { open } from "sqlite";
// import { google } from "googleapis";


const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(process.cwd(), "dashboard-data.json");

// ...existing code...
// API für Version
app.get("/api/version", (req, res) => {
  try {
    const version = fs.readFileSync(path.join(process.cwd(), "version.txt"), "utf-8").trim();
    res.json({ version });
  } catch (e) {
    res.json({ version: "unbekannt" });
  }
});

function loadConfig() {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      family: [],
      todos: [],
      mealplan: Array(7).fill(0).map(() => Array(3).fill("")),
      termine: Array(7).fill(0).map(() => []),
      standardItems: [
        { name: "Küche putzen", icon: "🧽" },
        { name: "Bad putzen", icon: "🛁" },
        { name: "Flur putzen", icon: "🧹" },
        { name: "Turnen", icon: "🤸" },
        { name: "Büro", icon: "💻" }
      ],
      standardItemPlan: Array(7).fill(0).map(() => []),
      standardItemPersonPlan: Array(7).fill(0).map(() => []),
    };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function saveConfig(cfg) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

app.get("/api/config", (req, res) => {
  res.json(loadConfig());
});

app.post("/api/config", (req, res) => {
  const cfg = req.body;
  saveConfig(cfg);
  res.json({ success: true });
});

// iCal-Feed abrufen und als JSON zurückgeben
app.get("/api/calendar", async (req, res) => {
  try {
    const config = loadConfig();
    const icalUrl = config.calendarIcalUrl;
    const family = config.family || [];
    if (!icalUrl) {
      return res.status(400).json({ error: "Kein iCal-Link hinterlegt." });
    }
    const response = await fetch(icalUrl);
    if (!response.ok) {
      return res.status(500).json({ error: "Fehler beim Abrufen des iCal-Feeds." });
    }
    const icalData = await response.text();
    const events = ical.parseICS(icalData);
    // Pro Tag: { [memberName]: [events], Kalender: [events] }
    const days = Array(7).fill(0).map(() => ({}));
    // Setze now auf Mitternacht (Europe/Berlin)
    const now = new Date();
    const nowBerlin = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    nowBerlin.setHours(0,0,0,0);
    // Finde Montag dieser Woche
    const dayOfWeek = nowBerlin.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(nowBerlin.getFullYear(), nowBerlin.getMonth(), nowBerlin.getDate() + mondayOffset);
    monday.setHours(0,0,0,0);
    
    for (const k in events) {
      const ev = events[k];
      if (ev.type === 'VEVENT' && ev.start) {
        // ev.start kann ein Date-Objekt oder ein Objekt mit tz-Info sein
        let startDate;
        let startTimeStr;
        
        // Prüfe, ob ev.start ein Objekt mit tz-Property ist (ical-Paket)
        if (ev.start && typeof ev.start === 'object' && ev.start.tz) {
          // Termin hat explizite Zeitzone (z.B. Europe/Berlin)
          // Die Zeit im Date-Objekt ist bereits in UTC konvertiert
          startDate = new Date(ev.start);
          startTimeStr = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ev.start.tz });
        } else if (ev.start instanceof Date) {
          // Prüfe ob es ein UTC-Termin ist (hat 'Z' im ursprünglichen Format)
          // Bei UTC-Terminen: toLocaleTimeString mit Europe/Berlin
          startDate = ev.start;
          startTimeStr = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' });
        } else {
          startDate = new Date(ev.start);
          startTimeStr = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' });
        }
        
        // Berechne den Tag in Europe/Berlin
        const startBerlin = new Date(startDate.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        startBerlin.setHours(0,0,0,0);
        
        // Tag im Bereich der aktuellen Woche (Montag=0)
        const diff = Math.round((startBerlin - monday) / (1000*60*60*24));
        if (diff >= 0 && diff < 7) {
          // Hilfsfunktion für End-Zeit
          function formatEndTime(d) {
            if (!d) return null;
            if (d && typeof d === 'object' && d.tz) {
              return new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: d.tz });
            }
            return new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' });
          }
          
          // Versuche, den Termin einem Familienmitglied zuzuordnen
          let matched = false;
          if (typeof ev.summary === 'string') {
            for (const member of family) {
              const prefix = member + ": ";
              if (ev.summary.startsWith(prefix)) {
                if (!days[diff][member]) days[diff][member] = [];
                days[diff][member].push({
                  summary: ev.summary.slice(prefix.length),
                  start: startTimeStr,
                  end: formatEndTime(ev.end),
                  location: ev.location || ""
                });
                matched = true;
                break;
              }
            }
          }
          if (!matched) {
            if (!days[diff]["Kalender"]) days[diff]["Kalender"] = [];
            days[diff]["Kalender"].push({
              summary: ev.summary,
              start: startTimeStr,
              end: formatEndTime(ev.end),
              location: ev.location || ""
            });
          }
        }
      }
    }
    res.json(days);
  } catch (e) {
    res.status(500).json({ error: "Fehler beim Verarbeiten des iCal-Feeds.", details: e.message });
  }
});

app.listen(4000, () => console.log("Backend läuft auf Port 4000"));
