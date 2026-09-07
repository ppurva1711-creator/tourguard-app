// TourGuard backend prototype
// Plain Express server. All "database" state lives in flat JSON files
// under /data so the whole backend can be inspected and reset by hand.

const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const FILES = {
  spots: path.join(DATA_DIR, "spots.json"),
  crowd: path.join(DATA_DIR, "crowd.json"),
  hotels: path.join(DATA_DIR, "hotels.json"),
  sos: path.join(DATA_DIR, "sos_log.json"),
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- tiny JSON-file helpers (our "database driver") ----------
async function readJSON(file) {
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw);
}
async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

// ---------- geo helpers ----------
const R_EARTH_KM = 6371;
function toRad(deg) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad) {
  return (rad * 180) / Math.PI;
}
function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R_EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function bearingDeg(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
function compass(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// crowd-level classification thresholds (nearby BLE device count)
function classifyCrowd(count) {
  if (count >= 20) return "High";
  if (count >= 8) return "Medium";
  return "Low";
}

// ---------- routes: tourist spots ----------
app.get("/api/spots", async (req, res) => {
  const spots = await readJSON(FILES.spots);
  res.json(spots);
});

app.get("/api/spots/:id", async (req, res) => {
  const spots = await readJSON(FILES.spots);
  const spot = spots.find((s) => s.id === req.params.id);
  if (!spot) return res.status(404).json({ error: "spot not found" });
  res.json(spot);
});

// ---------- routes: crowd status ----------
// GET all crowd status merged with spot names, for the dashboard
app.get("/api/crowd", async (req, res) => {
  const [spots, crowd] = await Promise.all([readJSON(FILES.spots), readJSON(FILES.crowd)]);
  const merged = spots.map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    ...(crowd[s.id] || { deviceCount: 0, level: "Low", lastUpdated: null }),
  }));
  res.json(merged);
});

// GET crowd status for a single spot - this is what an ESP32 unit polls
// before showing "crowded or not" on its OLED for the destination it's headed to.
app.get("/api/crowd/:spotId", async (req, res) => {
  const crowd = await readJSON(FILES.crowd);
  const entry = crowd[req.params.spotId];
  if (!entry) return res.status(404).json({ error: "no crowd data for this spot" });
  res.json({ spotId: req.params.spotId, ...entry });
});

// POST crowd reading - this is what a fixed BLE node (or the wearable's own
// scan) reports after each scan cycle: { "deviceCount": 14 }
app.post("/api/crowd/:spotId", async (req, res) => {
  const { deviceCount } = req.body;
  if (typeof deviceCount !== "number" || deviceCount < 0) {
    return res.status(400).json({ error: "deviceCount must be a non-negative number" });
  }
  const crowd = await readJSON(FILES.crowd);
  crowd[req.params.spotId] = {
    deviceCount,
    level: classifyCrowd(deviceCount),
    lastUpdated: new Date().toISOString(),
  };
  await writeJSON(FILES.crowd, crowd);
  res.json({ spotId: req.params.spotId, ...crowd[req.params.spotId] });
});

// ---------- routes: nearby hotel / homestay suggestions ----------
app.get("/api/hotels/nearby", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const limit = parseInt(req.query.limit, 10) || 5;
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: "lat and lng query params are required" });
  }
  const hotels = await readJSON(FILES.hotels);
  const withDistance = hotels
    .map((h) => ({ ...h, distanceKm: Math.round(haversineKm(lat, lng, h.lat, h.lng) * 100) / 100 }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
  res.json(withDistance);
});

// ---------- routes: route / navigation ----------
// Given the device's current position and a destination spot id, return
// distance + compass bearing - this is what drives the OLED's route line.
app.get("/api/route", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const destId = req.query.destId;
  if (Number.isNaN(lat) || Number.isNaN(lng) || !destId) {
    return res.status(400).json({ error: "lat, lng and destId query params are required" });
  }
  const spots = await readJSON(FILES.spots);
  const dest = spots.find((s) => s.id === destId);
  if (!dest) return res.status(404).json({ error: "destination spot not found" });

  const distanceKm = haversineKm(lat, lng, dest.lat, dest.lng);
  const bearing = bearingDeg(lat, lng, dest.lat, dest.lng);
  res.json({
    destination: dest.name,
    distanceKm: Math.round(distanceKm * 100) / 100,
    bearingDeg: Math.round(bearing),
    compass: compass(bearing),
  });
});

// ---------- routes: SOS ----------
app.post("/api/sos", async (req, res) => {
  const { lat, lng, deviceId } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "lat and lng are required numbers" });
  }
  const log = await readJSON(FILES.sos);
  const entry = {
    id: `sos_${Date.now()}`,
    deviceId: deviceId || "unknown",
    lat,
    lng,
    timestamp: new Date().toISOString(),
    resolved: false,
  };
  log.unshift(entry);
  await writeJSON(FILES.sos, log);
  res.status(201).json(entry);
});

app.get("/api/sos", async (req, res) => {
  const log = await readJSON(FILES.sos);
  res.json(log);
});

app.post("/api/sos/:id/resolve", async (req, res) => {
  const log = await readJSON(FILES.sos);
  const entry = log.find((e) => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: "sos entry not found" });
  entry.resolved = true;
  await writeJSON(FILES.sos, log);
  res.json(entry);
});

app.listen(PORT, () => {
  console.log(`TourGuard backend running at http://localhost:${PORT}`);
});
