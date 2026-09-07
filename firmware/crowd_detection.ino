/*
  TourGuard - Wearable Tourist Unit firmware (prototype)
  Board: ESP32 (WROOM-32)

  What this sketch does
  ----------------------
  1. Scans BLE advertisements to estimate how crowded the current /
     destination site is, using a de-duplicated, RSSI-filtered, moving-
     average count (not a raw "devices seen" number, which is noisy).
  2. Reads GPS (NEO-6M via TinyGPS++) and computes distance + compass
     bearing to a chosen destination.
  3. Drives an SSD1306 OLED showing: current position, destination,
     distance/direction, live crowd level, and a suggested nearby stay.
  4. Reports crowd counts to the backend (POST /api/crowd/:spotId) and
     pulls route + hotel-suggestion data from it (GET /api/route,
     GET /api/hotels/nearby) over WiFi/HTTP for this prototype.
  5. Handles a physical SOS button that POSTs current GPS to /api/sos.

  Production note
  ----------------
  The system architecture calls for BLE (short range) + LoRa (long
  range, off-grid) + GSM (cellular SOS fallback), not WiFi. WiFi is used
  here only because it is the fastest way to talk to a laptop-hosted
  Node backend during prototyping. To move to production:
    - Replace the WiFiClient/HTTPClient calls below with either
        a) a LoRa (SX1276 + RadioHead library) packet to the nearest
           fixed node, which forwards to the gateway, OR
        b) a SIM800L/SIM7600 GSM module using AT commands / TinyGSM,
           for direct cellular SOS when no mesh node is in range.
    - The BLE scanning + OLED logic below does not change either way;
      only the transport used to reach the backend changes.

  Required libraries (Arduino Library Manager)
  ----------------------------------------------
    - Adafruit SSD1306
    - Adafruit GFX Library
    - TinyGPSPlus (by Mikal Hart)
    - ArduinoJson (by Benoit Blanchon)
    - ESP32 BLE Arduino (bundled with the ESP32 board package)

  Wiring (typical)
  ------------------
    OLED SSD1306 (I2C):   SDA -> GPIO21, SCL -> GPIO22, VCC -> 3V3, GND -> GND
    NEO-6M GPS (UART):    TX -> GPIO16 (RX2), RX -> GPIO17 (TX2)
    SOS push button:      one leg -> GPIO4, other leg -> GND (uses internal pull-up)
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <TinyGPSPlus.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <set>

// ---------------------------------------------------------------------
// USER CONFIG - edit these for your setup
// ---------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BACKEND_HOST  = "http://192.168.1.100:3000";   // TourGuard backend base URL

// This unit's home site id (used when reporting crowd counts for the spot
// this fixed/wearable node is currently sitting at) and the destination
// the tourist has selected (used for route + destination-crowd lookups).
const char* THIS_SITE_ID   = "spot_market";
const char* DESTINATION_ID = "spot_fort";

// ---------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------
#define OLED_SDA      21
#define OLED_SCL      22
#define GPS_RX_PIN    16   // ESP32 RX2 <- GPS TX
#define GPS_TX_PIN    17   // ESP32 TX2 -> GPS RX
#define SOS_BUTTON_PIN 4

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define OLED_ADDR     0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
TinyGPSPlus gps;
HardwareSerial GPSSerial(2);

// ---------------------------------------------------------------------
// BLE crowd-detection state
// ---------------------------------------------------------------------
// Design notes (the "better algorithm" requested):
//   - De-duplicate by MAC address during a scan window, instead of
//     counting every advertisement packet (one device sends many).
//   - Filter by RSSI so only devices within ~15-20m are counted, which
//     keeps a busy road out of a monument's crowd count.
//   - Keep a short moving average across scan cycles so one noisy scan
//     doesn't flip the displayed crowd level back and forth.
const int8_t   RSSI_PROXIMITY_THRESHOLD = -75;   // dBm; closer to 0 = closer device
const uint32_t BLE_SCAN_WINDOW_SEC      = 5;
const uint8_t  MOVING_AVERAGE_WINDOW    = 3;

std::set<std::string> uniqueDevicesThisScan;
uint16_t movingAverageBuffer[MOVING_AVERAGE_WINDOW] = {0, 0, 0};
uint8_t  movingAverageIndex = 0;
uint16_t smoothedDeviceCount = 0;

class CrowdScanCallback : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    if (advertisedDevice.getRSSI() >= RSSI_PROXIMITY_THRESHOLD) {
      uniqueDevicesThisScan.insert(advertisedDevice.getAddress().toString());
    }
  }
};

BLEScan* bleScan;

uint16_t runBleCrowdScan() {
  uniqueDevicesThisScan.clear();
  bleScan->start(BLE_SCAN_WINDOW_SEC, false);
  bleScan->clearResults();

  uint16_t rawCount = uniqueDevicesThisScan.size();

  // update moving average
  movingAverageBuffer[movingAverageIndex] = rawCount;
  movingAverageIndex = (movingAverageIndex + 1) % MOVING_AVERAGE_WINDOW;
  uint32_t sum = 0;
  for (uint8_t i = 0; i < MOVING_AVERAGE_WINDOW; i++) sum += movingAverageBuffer[i];
  smoothedDeviceCount = sum / MOVING_AVERAGE_WINDOW;

  return smoothedDeviceCount;
}

String classifyCrowd(uint16_t count) {
  if (count >= 20) return "High";
  if (count >= 8)  return "Medium";
  return "Low";
}

// ---------------------------------------------------------------------
// Networking helpers
// ---------------------------------------------------------------------
bool wifiReady() {
  return WiFi.status() == WL_CONNECTED;
}

void reportCrowdToBackend(uint16_t deviceCount) {
  if (!wifiReady()) return;
  HTTPClient http;
  String url = String(BACKEND_HOST) + "/api/crowd/" + THIS_SITE_ID;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<64> doc;
  doc["deviceCount"] = deviceCount;
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("[crowd] POST %s -> %d\n", url.c_str(), code);
  http.end();
}

// Fetches distance/bearing to DESTINATION_ID and the destination's own
// crowd level, returned as a small struct-like set of globals for the
// OLED render step.
String g_destName = "--";
float  g_distKm = -1;
String g_compass = "--";
String g_destCrowdLevel = "--";
uint16_t g_destDeviceCount = 0;
String g_topStay = "--";

void refreshRouteAndCrowd() {
  if (!wifiReady() || gps.location.age() > 5000) return;

  double lat = gps.location.lat();
  double lng = gps.location.lng();

  // 1) route
  {
    HTTPClient http;
    String url = String(BACKEND_HOST) + "/api/route?lat=" + String(lat, 5) +
                 "&lng=" + String(lng, 5) + "&destId=" + DESTINATION_ID;
    http.begin(url);
    int code = http.GET();
    if (code == 200) {
      StaticJsonDocument<256> doc;
      deserializeJson(doc, http.getString());
      g_destName = doc["destination"].as<String>();
      g_distKm   = doc["distanceKm"].as<float>();
      g_compass  = doc["compass"].as<String>();
    }
    http.end();
  }

  // 2) destination crowd status
  {
    HTTPClient http;
    String url = String(BACKEND_HOST) + "/api/crowd/" + DESTINATION_ID;
    http.begin(url);
    int code = http.GET();
    if (code == 200) {
      StaticJsonDocument<256> doc;
      deserializeJson(doc, http.getString());
      g_destCrowdLevel  = doc["level"].as<String>();
      g_destDeviceCount = doc["deviceCount"].as<uint16_t>();
    }
    http.end();
  }

  // 3) top nearby stay suggestion
  {
    HTTPClient http;
    String url = String(BACKEND_HOST) + "/api/hotels/nearby?lat=" + String(lat, 5) +
                 "&lng=" + String(lng, 5) + "&limit=1";
    http.begin(url);
    int code = http.GET();
    if (code == 200) {
      StaticJsonDocument<512> doc;
      deserializeJson(doc, http.getString());
      if (doc.size() > 0) g_topStay = doc[0]["name"].as<String>();
    }
    http.end();
  }
}

void sendSos() {
  if (!wifiReady() || !gps.location.isValid()) {
    Serial.println("[sos] cannot send: no WiFi or no GPS fix");
    return;
  }
  HTTPClient http;
  String url = String(BACKEND_HOST) + "/api/sos";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["lat"] = gps.location.lat();
  doc["lng"] = gps.location.lng();
  doc["deviceId"] = "wearable-01";
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("[sos] POST -> %d\n", code);
  http.end();
}

// ---------------------------------------------------------------------
// OLED rendering
// ---------------------------------------------------------------------
String truncate(String s, uint8_t n) {
  if (s.length() <= n) return s;
  return s.substring(0, n - 1) + "~";
}

void renderDisplay(uint16_t liveDeviceCount) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  display.setCursor(0, 0);
  if (gps.location.isValid()) {
    display.printf("GPS %.4f,%.4f", gps.location.lat(), gps.location.lng());
  } else {
    display.print("GPS: acquiring fix...");
  }

  display.setCursor(0, 14);
  display.print("DEST: " + truncate(g_destName, 18));

  display.setCursor(0, 26);
  if (g_distKm >= 0) {
    display.printf("DIST: %.2fkm  DIR: %s", g_distKm, g_compass.c_str());
  } else {
    display.print("DIST: --   DIR: --");
  }

  display.setCursor(0, 38);
  display.print("DEST CROWD: " + g_destCrowdLevel + " (" + String(g_destDeviceCount) + ")");

  display.setCursor(0, 50);
  display.print("HERE: " + classifyCrowd(liveDeviceCount) + " (" + String(liveDeviceCount) + ")");

  display.setCursor(0, 62);
  display.print("STAY: " + truncate(g_topStay, 18));

  display.display();
}

// ---------------------------------------------------------------------
// Setup / loop
// ---------------------------------------------------------------------
unsigned long lastScanMillis = 0;
const unsigned long SCAN_INTERVAL_MS = 15000;   // BLE scan + backend sync every 15s

void setup() {
  Serial.begin(115200);
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("SSD1306 init failed");
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("TourGuard booting...");
  display.display();

  GPSSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStart < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println(wifiReady() ? "\nWiFi connected" : "\nWiFi NOT connected (offline mode)");

  BLEDevice::init("");
  bleScan = BLEDevice::getScan();
  bleScan->setAdvertisedDeviceCallbacks(new CrowdScanCallback());
  bleScan->setActiveScan(true);
  bleScan->setInterval(100);
  bleScan->setWindow(99);
}

void loop() {
  // keep the GPS parser fed continuously
  while (GPSSerial.available() > 0) {
    gps.encode(GPSSerial.read());
  }

  // SOS button is checked every loop iteration (no waiting on the scan interval)
  if (digitalRead(SOS_BUTTON_PIN) == LOW) {
    Serial.println("[sos] button pressed");
    display.clearDisplay();
    display.setCursor(20, 28);
    display.setTextSize(2);
    display.println("SOS SENT");
    display.display();
    sendSos();
    delay(2000);
    display.setTextSize(1);
  }

  if (millis() - lastScanMillis >= SCAN_INTERVAL_MS) {
    lastScanMillis = millis();

    uint16_t liveCount = runBleCrowdScan();
    Serial.printf("[ble] nearby devices (smoothed): %u -> %s\n",
                  liveCount, classifyCrowd(liveCount).c_str());

    reportCrowdToBackend(liveCount);
    refreshRouteAndCrowd();
    renderDisplay(liveCount);
  }
}
