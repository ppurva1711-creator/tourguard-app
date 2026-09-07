# TourGuard Prototype

A runnable prototype of the TourGuard concept: a Node/Express backend backed by
flat JSON files (the "database"), a web dashboard that mirrors what the
wearable's OLED shows, and an ESP32 firmware sketch that does real BLE-based
crowd detection.

## Project layout

```
tourguard-app/
  server.js              Express backend (all API routes)
  package.json
  data/
    spots.json           Tourist site master list (id, name, lat, lng)
    crowd.json           Live crowd status per site (updated by POST /api/crowd/:id)
    hotels.json          Hotel / homestay listings
    sos_log.json         SOS alert log (grows at runtime)
  public/
    index.html           Dashboard shell
    styles.css           Dashboard styling
    app.js               Dashboard logic (fetches the API above)
  firmware/
    crowd_detection.ino  ESP32 sketch: BLE crowd scan, GPS, OLED, SOS
```

## Running the backend + dashboard

```bash
cd tourguard-app
npm install
npm start
```

Then open `http://localhost:3000` in a browser. The dashboard:

- **Crowd & site status** — reads `GET /api/crowd`, one card per tourist site,
  colour-coded Low / Medium / High from live BLE device counts.
- **Nearby stays** — enter or geolocate a position and hit *Find stays*; calls
  `GET /api/hotels/nearby?lat=&lng=` and lists the closest hotels/homestays.
- **Device preview** — picking a destination calls `GET /api/route` (distance +
  compass bearing) and `GET /api/crowd/:id`, and renders exactly what the
  ESP32's OLED renders in the firmware (see below) so you can demo the
  end-to-end idea without hardware in the room.
- **SOS feed** — `POST /api/sos` from either the dashboard's simulate button or
  a real device; `GET /api/sos` lists alerts, with a resolve action.

Data lives in the `data/*.json` files and resets to the seed values whenever
you restore those files (they're plain text — inspect or hand-edit them
directly).

## API summary

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/spots` | list tourist sites |
| GET | `/api/crowd` | crowd status for all sites (dashboard) |
| GET | `/api/crowd/:spotId` | crowd status for one site (what the wearable polls for its destination) |
| POST | `/api/crowd/:spotId` | report a BLE device count `{ "deviceCount": 14 }` (what a node/wearable posts) |
| GET | `/api/hotels/nearby?lat=&lng=&limit=` | nearest hotels/homestays |
| GET | `/api/route?lat=&lng=&destId=` | distance (km) + compass bearing to a destination |
| POST | `/api/sos` | log an SOS `{ "lat", "lng", "deviceId" }` |
| GET | `/api/sos` | list SOS alerts |
| POST | `/api/sos/:id/resolve` | mark an alert resolved |

## Firmware: `firmware/crowd_detection.ino`

Flash this to an ESP32 with an SSD1306 OLED and a NEO-6M GPS attached (wiring
and required libraries are documented in the file's header comment). At a
high level, each scan cycle (every 15s) it:

1. Runs a BLE scan and **de-duplicates by MAC address**, **filters by RSSI**
   (`-75dBm` default) so only devices within ~15-20m count, and keeps a
   3-cycle **moving average** so the crowd reading doesn't flicker between
   levels on a single noisy scan. This is the "better algorithm" requested —
   plain "devices seen" counts double-count and pick up unrelated passers-by.
2. Posts that smoothed count to `POST /api/crowd/:THIS_SITE_ID`.
3. Pulls `GET /api/route` + `GET /api/crowd/:DESTINATION_ID` + `GET
   /api/hotels/nearby` from the backend and renders GPS position, distance +
   compass direction to the destination, the destination's live crowd level,
   the device's own local crowd level, and the top nearby-stay suggestion —
   all on the OLED.
4. Watches a push-button pin; on press it POSTs the current GPS fix to
   `/api/sos`.

Before flashing, edit the `USER CONFIG` block at the top of the file:
`WIFI_SSID`, `WIFI_PASSWORD`, `BACKEND_HOST` (your machine's LAN IP, not
`localhost`), `THIS_SITE_ID`, and `DESTINATION_ID`.

**Why WiFi here, not BLE/LoRa/GSM:** the target architecture uses BLE for
short range, LoRa for the off-grid mesh, and GSM for cellular SOS. This
prototype uses the ESP32's built-in WiFi to reach a laptop-hosted backend
because it's the fastest way to demo the full loop without extra radio
hardware. The BLE scanning and OLED logic are unchanged in production; only
the transport used to reach the backend would be swapped for LoRa (via a
RadioHead-based packet to the nearest fixed node) or GSM (via a SIM800L/SIM7600
module), as noted in the sketch's header comment.
