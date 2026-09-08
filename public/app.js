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
    <button class="spot-card level-${s.level}" type="button" data-spot-id="${s.id}" aria-label="Select ${s.name} as destination">
      <span class="spot-count">${s.deviceCount} devices</span>
      <div class="spot-name">${s.name}</div>
      <div class="spot-meta">updated ${timeAgo(s.lastUpdated)}</div>
      <span class="spot-level">${s.level.toUpperCase()}</span>
    </button>`
    )
    .join("");
  grid.querySelectorAll(".spot-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.getElementById("oled-dest-select").value = card.dataset.spotId;
      refreshOled();
    });
  });
}

function timeAgo(iso) {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ---------- hotel panel ----------
function setLocationStatus(message) {
  document.getElementById("location-status").textContent = message;
}

async function findNearby(lat, lng) {
  const hotelList = document.getElementById("hotel-list");
  const restaurantList = document.getElementById("restaurant-list");
  hotelList.innerHTML = `<p class="empty-state">Searching&hellip;</p>`;
  restaurantList.innerHTML = `<p class="empty-state">Searching&hellip;</p>`;
  setLocationStatus(`Showing places near ${lat.toFixed(4)}, ${lng.toFixed(4)}.`);
  try {
  const [hotelsRes, restaurantsRes] = await Promise.all([
      fetch(`${API}/hotels/nearby?lat=${lat}&lng=${lng}&limit=5`),
      fetch(`${API}/restaurants/nearby?lat=${lat}&lng=${lng}&limit=5`),
    ]);
    if (!hotelsRes.ok || !restaurantsRes.ok) throw new Error("nearby request failed");
    const [hotels, restaurants] = await Promise.all([hotelsRes.json(), restaurantsRes.json()]);
    hotelList.innerHTML = renderPlaceList(hotels, "No stays found nearby.", (h) =>
      `${h.type} &middot; \u20b9${h.pricePerNight}/night &middot; \u2605 ${h.rating}`
    );
    restaurantList.innerHTML = renderPlaceList(restaurants, "No restaurants found nearby.", (r) =>
      `${r.type} &middot; \u20b9${r.priceForTwo} for two &middot; \u2605 ${r.rating}`
    );
    if (hotels.length) updateOledStay(hotels[0].name);
  } catch (e) {
    hotelList.innerHTML = `<p class="empty-state">Could not reach backend.</p>`;
    restaurantList.innerHTML = `<p class="empty-state">Could not reach backend.</p>`;
    setLocationStatus("Nearby places could not be loaded. Check the backend and try again.");
  }
}

function renderPlaceList(places, emptyMessage, details) {
  if (!places.length) return `<p class="empty-state">${emptyMessage}</p>`;
  return places
    .map(
      (place) => `
      <div class="hotel-row">
        <div>
         <div class="hotel-name">${place.name}</div>
          <div class="hotel-meta">${details(place)}</div>
        </div>
       <div class="hotel-dist">${place.distanceKm} km</div>
      </div>`
     )
    .join("");
}

document.getElementById("locate-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const lat = parseFloat(document.getElementById("in-lat").value);
  const lng = parseFloat(document.getElementById("in-lng").value);
   findNearby(lat, lng);
});

function requestLocation() {
  if (!navigator.geolocation) {
    setLocationStatus("Geolocation is not supported in this browser. Enter coordinates instead.");
    return;
  }
  setLocationStatus("Requesting your device location…");
  navigator.geolocation.getCurrentPosition((pos) => {
    document.getElementById("in-lat").value = pos.coords.latitude.toFixed(4);
    document.getElementById("in-lng").value = pos.coords.longitude.toFixed(4);
    findNearby(pos.coords.latitude, pos.coords.longitude);
  }, () => {
    setLocationStatus("Location access was not granted. Enter coordinates instead.");
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}

document.getElementById("use-gps").addEventListener("click", requestLocation);

document.getElementById("share-location").addEventListener("click", () => {
  document.getElementById("location-dialog").classList.add("hidden");
  requestLocation();
});

document.getElementById("enter-location").addEventListener("click", () => {
  document.getElementById("location-dialog").classList.add("hidden");
  document.getElementById("in-lat").focus();
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
    renderSafetyBrief();
    return;
  }

  try {
    const [routeRes, crowdRes, safetyRes] = await Promise.all([
      fetch(`${API}/route?lat=${lat}&lng=${lng}&destId=${destId}`),
      fetch(`${API}/crowd/${destId}`),
      fetch(`${API}/safety/brief?lat=${lat}&lng=${lng}&destId=${destId}`),
    ]);
    if (!routeRes.ok || !crowdRes.ok || !safetyRes.ok) throw new Error("route request failed");
    const route = await routeRes.json();
    const crowd = await crowdRes.json();
    const brief = await safetyRes.json();
    lines[1].textContent = `DEST: ${truncate(route.destination, 20)}`;
    lines[2].textContent = `DIST: ${route.distanceKm}km  DIR: ${route.compass}`;
    lines[3].textContent = `CROWD: ${crowd.level.toUpperCase()} (${crowd.deviceCount})`;
    lines[4].textContent = `STAY: ${lastOledStay}`;
    renderSafetyBrief(brief);
  } catch (e) {
    lines[1].textContent = "DEST: error fetching route";
    renderSafetyBrief(null, "Safety guidance could not be loaded. Check the backend and try again.");
  }
}

document.getElementById("oled-dest-select").addEventListener("change", refreshOled);

function renderSafetyBrief(brief, errorMessage = "") {
  const state = document.getElementById("safety-state");
  const content = document.getElementById("safety-content");
  const metrics = document.getElementById("safety-metrics");
  if (!brief) {
    state.className = `safety-state is-idle${errorMessage ? " is-error" : ""}`;
    state.textContent = errorMessage ? "UNAVAILABLE" : "SELECT A SITE";
    content.innerHTML = `<div class="safety-icon" aria-hidden="true">${errorMessage ? "!" : "⌖"}</div><div><p class="safety-title">${errorMessage || "Choose a destination to receive a travel brief."}</p><p class="safety-message">${errorMessage ? "The wearable preview remains available once the connection is restored." : "TourGuard will combine the route, walking estimate, and current crowd signal in one quick decision aid."}</p></div>`;
    metrics.hidden = true;
    return;
  }
  const level = brief.crowd.level.toLowerCase();
  state.className = `safety-state level-${level}`;
  state.textContent = brief.status.toUpperCase();
  content.innerHTML = `<div class="safety-icon level-${level}" aria-hidden="true">${level === "high" ? "!" : "✓"}</div><div><p class="safety-title">${brief.destination}</p><p class="safety-message">${brief.message}</p></div>`;
  document.getElementById("brief-route").textContent = `${brief.distanceKm} km ${brief.compass}`;
  document.getElementById("brief-walk").textContent = `~${brief.walkingMinutes} min`;
  document.getElementById("brief-signal").textContent = `${brief.crowd.level} · ${brief.crowd.deviceCount}`;
  metrics.hidden = false;
}


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
