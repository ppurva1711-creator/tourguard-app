const API = "/api";

let spotsCache = [];

// ---------- clock + connection dot ----------
function tickClock() {
  const el = document.getElementById("clock");
  el.textContent = new Date().toLocaleTimeString();
}
setInterval(tickClock, 1000);
tickClock();

function setConnected(ok) {
  document.getElementById("conn-dot").classList.toggle("live", ok);
  document.getElementById("conn-label").textContent = ok ? "live" : "offline";
}

// ---------- crowd panel ----------
async function loadCrowd() {
  try {
    const res = await fetch(`${API}/crowd`);
    if (!res.ok) throw new Error("bad response");
    const spots = await res.json();
    spotsCache = spots;
    setConnected(true);
    renderSpotGrid(spots);
    populateDestSelect(spots);
  } catch (e) {
    setConnected(false);
  }
}

function renderSpotGrid(spots) {
  const grid = document.getElementById("spot-grid");
  grid.innerHTML = spots
    .map(
      (s) => `
    <div class="spot-card level-${s.level}">
      <span class="spot-count">${s.deviceCount} devices</span>
      <div class="spot-name">${s.name}</div>
      <div class="spot-meta">updated ${timeAgo(s.lastUpdated)}</div>
      <span class="spot-level">${s.level.toUpperCase()}</span>
    </div>`
    )
    .join("");
}

function timeAgo(iso) {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ---------- hotel panel ----------
async function findHotels(lat, lng) {
  const list = document.getElementById("hotel-list");
  list.innerHTML = `<p class="empty-state">Searching&hellip;</p>`;
  try {
    const res = await fetch(`${API}/hotels/nearby?lat=${lat}&lng=${lng}&limit=5`);
    const hotels = await res.json();
    if (!hotels.length) {
      list.innerHTML = `<p class="empty-state">No stays found nearby.</p>`;
      return;
    }
    list.innerHTML = hotels
      .map(
        (h) => `
      <div class="hotel-row">
        <div>
          <div class="hotel-name">${h.name}</div>
          <div class="hotel-meta">${h.type} &middot; \u20b9${h.pricePerNight}/night &middot; \u2605 ${h.rating}</div>
        </div>
        <div class="hotel-dist">${h.distanceKm} km</div>
      </div>`
      )
      .join("");
    // feed the top suggestion into the OLED preview's STAY line
    updateOledStay(hotels[0].name);
  } catch (e) {
    list.innerHTML = `<p class="empty-state">Could not reach backend.</p>`;
  }
}

document.getElementById("locate-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const lat = parseFloat(document.getElementById("in-lat").value);
  const lng = parseFloat(document.getElementById("in-lng").value);
  findHotels(lat, lng);
});

document.getElementById("use-gps").addEventListener("click", () => {
  if (!navigator.geolocation) return alert("Geolocation not supported in this browser.");
  navigator.geolocation.getCurrentPosition((pos) => {
    document.getElementById("in-lat").value = pos.coords.latitude.toFixed(4);
    document.getElementById("in-lng").value = pos.coords.longitude.toFixed(4);
    findHotels(pos.coords.latitude, pos.coords.longitude);
  });
});

// ---------- OLED preview panel ----------
function populateDestSelect(spots) {
  const sel = document.getElementById("oled-dest-select");
  const current = sel.value;
  sel.innerHTML =
    `<option value="">Select destination&hellip;</option>` +
    spots.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
  if (current) sel.value = current;
}

let lastOledStay = "--";

function updateOledStay(name) {
  lastOledStay = name;
  const lines = document.querySelectorAll("#oled-screen .oled-line");
  if (lines[4]) lines[4].textContent = `STAY: ${truncate(name, 20)}`;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "\u2026" : str;
}

async function refreshOled() {
  const destId = document.getElementById("oled-dest-select").value;
  const lat = parseFloat(document.getElementById("in-lat").value) || 18.517;
  const lng = parseFloat(document.getElementById("in-lng").value) || 73.855;
  const lines = document.querySelectorAll("#oled-screen .oled-line");
  lines[0].textContent = `GPS ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  if (!destId) {
    lines[1].textContent = "DEST: -- select a site --";
    lines[2].textContent = "DIST: --   DIR: --";
    lines[3].textContent = "CROWD: --";
    lines[4].textContent = `STAY: ${lastOledStay}`;
    return;
  }

  try {
    const [routeRes, crowdRes] = await Promise.all([
      fetch(`${API}/route?lat=${lat}&lng=${lng}&destId=${destId}`),
      fetch(`${API}/crowd/${destId}`),
    ]);
    const route = await routeRes.json();
    const crowd = await crowdRes.json();
    lines[1].textContent = `DEST: ${truncate(route.destination, 20)}`;
    lines[2].textContent = `DIST: ${route.distanceKm}km  DIR: ${route.compass}`;
    lines[3].textContent = `CROWD: ${crowd.level.toUpperCase()} (${crowd.deviceCount})`;
    lines[4].textContent = `STAY: ${lastOledStay}`;
  } catch (e) {
    lines[1].textContent = "DEST: error fetching route";
  }
}

document.getElementById("oled-dest-select").addEventListener("change", refreshOled);

// ---------- SOS panel ----------
async function loadSos() {
  try {
    const res = await fetch(`${API}/sos`);
    const log = await res.json();
    renderSos(log);
  } catch (e) {
    /* leave panel as-is if backend unreachable */
  }
}

function renderSos(log) {
  const list = document.getElementById("sos-list");
  if (!log.length) {
    list.innerHTML = `<p class="empty-state">No alerts yet.</p>`;
    return;
  }
  list.innerHTML = log
    .map(
      (e) => `
    <div class="sos-row ${e.resolved ? "resolved" : ""}" data-id="${e.id}">
      <div class="sos-time">${new Date(e.timestamp).toLocaleString()}</div>
      <div class="sos-coords">${e.lat.toFixed(4)}, ${e.lng.toFixed(4)} &middot; ${e.deviceId}</div>
      ${e.resolved ? "" : `<button class="sos-resolve" data-id="${e.id}">Mark resolved</button>`}
    </div>`
    )
    .join("");

  list.querySelectorAll(".sos-resolve").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch(`${API}/sos/${btn.dataset.id}/resolve`, { method: "POST" });
      loadSos();
    });
  });
}

document.getElementById("trigger-sos").addEventListener("click", async () => {
  const lat = parseFloat(document.getElementById("in-lat").value) || 18.517;
  const lng = parseFloat(document.getElementById("in-lng").value) || 73.855;
  await fetch(`${API}/sos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, deviceId: "web-console-sim" }),
  });
  loadSos();
});

// ---------- boot ----------
async function boot() {
  await loadCrowd();
  await loadSos();
  refreshOled();
}
boot();
setInterval(loadCrowd, 6000);
setInterval(loadSos, 6000);
setInterval(refreshOled, 6000);
