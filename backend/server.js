
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import ical from "ical";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), "dashboard-data.json");

function loadConfig() {
  if (!fs.existsSync(DATA_FILE)) {
    return { family: [], calendarIcalUrl: null };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function saveConfig(cfg) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

app.get("/api/config", (req, res) => res.json(loadConfig()));
app.post("/api/config", (req, res) => { saveConfig(req.body); res.json({ success: true }); });

// API für Version (liefert Inhalt von version.txt)
app.get("/api/version", (req, res) => {
  try {
    const versionPath = path.join(process.cwd(), "version.txt");
    const version = fs.readFileSync(versionPath, "utf-8").trim();
    res.json({ version });
  } catch (e) {
    res.json({ version: "unbekannt" });
  }
});

// Return weekly buckets with events that include only summary and location
app.get("/api/calendar", async (req, res) => {
  try {
    const cfg = loadConfig();
    const icalUrl = cfg.calendarIcalUrl;
    const family = cfg.family || [];
    if (!icalUrl) return res.status(400).json({ error: "Kein iCal-Link hinterlegt." });

    const response = await fetch(icalUrl);
    if (!response.ok) return res.status(500).json({ error: "Fehler beim Abrufen des iCal-Feeds." });
    const icalData = await response.text();
    const events = ical.parseICS(icalData);

    // Build a map of UID -> original DTSTART token from the raw ICS
    const dtstartMap = {};
    try {
      const veventRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
      let m;
      while ((m = veventRe.exec(icalData)) !== null) {
        const block = m[1];
        const uidMatch = /UID:(.+)/.exec(block);
        const dtMatch = /DTSTART(;[^:]*)?:(.+)/.exec(block);
        if (uidMatch && dtMatch) {
          dtstartMap[uidMatch[1].trim()] = { params: dtMatch[1] ? dtMatch[1].trim() : null, value: dtMatch[2].trim() };
        }
      }
    } catch (e) {
      // ignore parsing errors of the raw ICS
    }

    const days = Array.from({ length: 7 }, () => ({}));

    const now = new Date();
    const nowBerlin = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    nowBerlin.setHours(0,0,0,0);
    const dayOfWeek = nowBerlin.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(nowBerlin.getFullYear(), nowBerlin.getMonth(), nowBerlin.getDate() + mondayOffset);
    monday.setHours(0,0,0,0);

    function formatEventStart(ev) {
      try {
        let d = ev.start instanceof Date ? ev.start : new Date(ev.start);
        if (isNaN(d.getTime())) return null;
        // Determine whether this is a date-only (all-day) event. If the original
        // DTSTART token exists and lacks a time component, treat as all-day.
        const dtInfo = ev.uid && dtstartMap[ev.uid] ? dtstartMap[ev.uid] : null;
        const dtValue = dtInfo && dtInfo.value ? dtInfo.value : null;
        // If DTSTART token missing 'T', it's an all-day event
        const isAllDay = dtValue ? !dtValue.includes('T') : (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);
        if (isAllDay) return null;
        // If we have the original token and it does NOT end with Z, the time is
        // floating or already local — show the authored clock without converting.
        if (dtValue && !dtValue.endsWith('Z')) {
          // dtValue like 20260116T094500 or 20260116T094500 (no Z)
          const timePart = dtValue.split('T')[1];
          if (timePart) {
            const hh = timePart.substring(0,2);
            const mm = timePart.substring(2,4);
            return `${hh}:${mm}`;
          }
        }
        // Otherwise (dtValue endsWith Z or no original token) convert instant to Berlin
        return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin' });
      } catch (e) {
        return null;
      }
    }

    for (const k in events) {
      const ev = events[k];
      if (ev.type === 'VEVENT' && ev.start) {
        const startDate = ev.start instanceof Date ? ev.start : new Date(ev.start);
        const startBerlin = new Date(startDate.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        startBerlin.setHours(0,0,0,0);
        const diff = Math.round((startBerlin - monday) / (1000*60*60*24));
        if (diff >= 0 && diff < 7) {
          const startTimeStr = formatEventStart(ev);
          let matched = false;
          if (typeof ev.summary === 'string') {
            for (const member of family) {
              const prefix = member + ': ';
              if (ev.summary.startsWith(prefix)) {
                if (!days[diff][member]) days[diff][member] = [];
                const item = { summary: ev.summary.slice(prefix.length), location: ev.location || '' };
                if (startTimeStr != null) item.start = startTimeStr;
                days[diff][member].push(item);
                matched = true; break;
              }
            }
          }
          if (!matched) {
            if (!days[diff]['Kalender']) days[diff]['Kalender'] = [];
            const item = { summary: ev.summary, location: ev.location || '' };
            if (startTimeStr != null) item.start = startTimeStr;
            days[diff]['Kalender'].push(item);
          }
        }
      }
    }

    res.json(days);
  } catch (e) {
    res.status(500).json({ error: 'Fehler beim Verarbeiten des iCal-Feeds.', details: e.message });
  }
});

// Debug endpoint returns only non-time fields
app.get('/api/calendar-debug', async (req, res) => {
  try {
    const cfg = loadConfig();
    const icalUrl = cfg.calendarIcalUrl;
    if (!icalUrl) return res.status(400).json({ error: 'Kein iCal-Link hinterlegt.' });
    const q = (req.query.q || '').toString().trim();
    const response = await fetch(icalUrl);
    const icalData = await response.text();
    const events = ical.parseICS(icalData);
    const debugEvents = [];
    for (const k in events) {
      const ev = events[k];
      if (ev.type === 'VEVENT' && ev.start) {
        if (q && typeof ev.summary === 'string' && !ev.summary.includes(q)) continue;
        debugEvents.push({ summary: ev.summary, uid: ev.uid || null, location: ev.location || '', status: ev.status || null });
      }
    }
    res.json(debugEvents);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Inspect raw event start fields for debugging timezone issues
app.get('/api/calendar-inspect', async (req, res) => {
  try {
    const cfg = loadConfig();
    const icalUrl = cfg.calendarIcalUrl;
    if (!icalUrl) return res.status(400).json({ error: 'Kein iCal-Link hinterlegt.' });
    const response = await fetch(icalUrl);
    if (!response.ok) return res.status(500).json({ error: 'Fehler beim Abrufen des iCal-Feeds.' });
    const icalData = await response.text();
    const events = ical.parseICS(icalData);
    const out = [];
    for (const k in events) {
      const ev = events[k];
      if (ev.type === 'VEVENT' && ev.start) {
        let startRawString = null;
        try { startRawString = ev.start instanceof Date ? ev.start.toString() : String(ev.start); } catch (e) { startRawString = String(ev.start); }
        let startISO = null;
        try {
          if (ev.start instanceof Date && !isNaN(ev.start.getTime())) startISO = ev.start.toISOString();
          else {
            const d = new Date(ev.start);
            if (!isNaN(d.getTime())) startISO = d.toISOString();
          }
        } catch (e) { /* ignore */ }
        out.push({ summary: ev.summary || null, uid: ev.uid || null, location: ev.location || '', startRaw: startRawString, startISO, startIsDate: ev.start instanceof Date });
      }
    }
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Simple weather proxy with in-memory caching
const weatherCache = { ts: 0, data: null };
const WEATHER_TTL = (process.env.WEATHER_CACHE_TTL_SECONDS ? parseInt(process.env.WEATHER_CACHE_TTL_SECONDS, 10) : 600) * 1000; // default 10min

app.get('/api/weather', async (req, res) => {
  try {
    const now = Date.now();
    if (weatherCache.data && (now - weatherCache.ts) < WEATHER_TTL) {
      return res.json({ cached: true, ...weatherCache.data });
    }

    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) return res.status(500).json({ error: 'No weather API key configured' });

    const cfg = loadConfig();
    const lat = (cfg && cfg.weatherLat) || process.env.WEATHER_LAT || '53.865';
    const lon = (cfg && cfg.weatherLon) || process.env.WEATHER_LON || '10.686';
    const units = 'metric';
    const lang = 'de';

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=${units}&lang=${lang}&appid=${encodeURIComponent(key)}`;
    const r = await fetch(url);
    const respText = await r.text();
    let body = null;
    try { body = JSON.parse(respText); } catch (e) { body = respText; }
    if (!r.ok) {
      console.error('Weather provider returned non-OK', r.status, respText);
      return res.status(502).json({ error: 'Weather provider error', status: r.status, provider: body });
    }

    const data = {
      temp: body.main?.temp ?? null,
      feels_like: body.main?.feels_like ?? null,
      desc: body.weather && body.weather[0] && body.weather[0].description ? String(body.weather[0].description) : null,
      icon: body.weather && body.weather[0] && body.weather[0].icon ? String(body.weather[0].icon) : null,
      city: body.name || null,
      humidity: body.main?.humidity ?? null,
      wind_speed: body.wind?.speed ?? null,
      raw: body
    };

    weatherCache.ts = now;
    weatherCache.data = data;

    res.json({ cached: false, ...data });
  } catch (e) {
    console.error('Error in /api/weather', e && e.stack || e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(4000, () => console.log('Backend läuft auf Port 4000'));
