# TourGuard Flutter Starter

This starter was created from the supplied TourGuard prototype repository.

## Existing Node backend reused

The existing backend already provides:

- `GET /api/spots`
- `GET /api/crowd`
- `GET /api/crowd/:spotId`
- `POST /api/crowd/:spotId`
- `GET /api/hotels/nearby`
- `GET /api/route`
- `POST /api/sos`
- `GET /api/sos`
- `POST /api/sos/:id/resolve`

The Flutter starter currently integrates SOS logging through `POST /api/sos`.

## Current pages

1. Home dashboard
2. Map & GPS page
3. Nearby hotels/restaurants using local JSON assets and Haversine-like `latlong2` distance calculations
4. SOS page
5. Safety/fall-detection architecture page

## Important offline architecture

The nearby search already works from local assets and does not require the Node backend.

The map page currently uses online OpenStreetMap raster tiles during development. For real offline maps, the next phase should replace the `TileLayer` with an MBTiles/local tile provider and package/download the selected region's tiles to the device.

## Run

```bash
flutter pub get
flutter run
```

## Backend

Run the existing project separately:

```bash
cd tourguard-app
npm install
npm start
```

For Android emulator, backend URL is normally `http://10.0.2.2:3000`.
For a physical phone, use your computer's LAN IP, for example `http://192.168.1.10:3000`.

## Hardware integration plan

ESP32 hardware should own hardware-critical functions:

- GPS module -> live location
- MPU6050 -> fall detection
- SIM/GSM module -> SMS to emergency contacts
- BLE -> app/device communication
- optional SD card -> offline maps, POIs and route data

Flutter should act as the user interface and optional companion application.

## Next recommended page

Build the real offline map page next, followed by a destination + offline route page, then BLE communication with ESP32.
