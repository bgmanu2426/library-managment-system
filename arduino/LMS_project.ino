#include <HTTPClient.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <Wire.h>
#include <SPI.h>
#include <SSD1306Wire.h>
#include <ArduinoJson.h>
#include "Rancho_Regular.h"
#include "secrets.h"

#define SS_PIN 21
#define RST_PIN 5

MFRC522 mfrc522(SS_PIN, RST_PIN);

const char *ssid = WLAN_USERNAME;
const char *password = WLAN_PASSWORD;

#define OLED_SDA 4
#define OLED_SCL 22
SSD1306Wire display(0x3C, OLED_SDA, OLED_SCL, GEOMETRY_128_32);

void setup() {
  Serial.begin(9600);
  SPI.begin();
  mfrc522.PCD_Init();
  display.init();
  display.flipScreenVertically();
  connectToWiFi();
}

void loop() {
  if (!WiFi.isConnected()) {
    connectToWiFi();
  }

  display.clear();
  display.setFont(ArialMT_Plain_10);
  display.setTextAlignment(TEXT_ALIGN_CENTER);
  display.drawString(64, 11, "Scan Your Card");
  display.display();

  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  String CardID = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    CardID += mfrc522.uid.uidByte[i];
  }

  CardID.replace(" ", "");
  Serial.print(CardID);
  SendCardID(CardID);
}

void SendCardID(String Card_uid) {
  display.clear();
  display.setFont(ArialMT_Plain_10);
  display.setTextAlignment(TEXT_ALIGN_CENTER);
  display.drawString(64, 11, "Waiting for response");
  display.display();

  if (WiFi.isConnected()) {
    HTTPClient http;
    
    // Set the endpoint URL
    String Link = String(REQ_URL) + "/api/scan-info/get-uid";
    http.begin(Link);
    
    // Set headers
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", "lms_g9-yIq13f6ICpwPngkAa-tTzTeCcrzO9UMoCofz6");
    
    // Create JSON payload
    StaticJsonDocument<200> requestDoc;
    requestDoc["uid"] = Card_uid;
    String requestBody;
    serializeJson(requestDoc, requestBody);
    
    // Send POST request
    int httpCode = http.POST(requestBody);
    String payload_string = http.getString();
    Serial.println(httpCode);
    Serial.println(payload_string);
    
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload_string);

    if (error) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.f_str());
      display.clear();
      display.setFont(ArialMT_Plain_10);
      display.setTextAlignment(TEXT_ALIGN_CENTER);
      display.drawString(64, 11, "Parse Error");
      display.display();
      delay(2000);
      http.end();
      return;
    }

    const char *message = doc["message"];

    if (httpCode == 200 || httpCode == 201) {
      display.clear();
      display.setFont(ArialMT_Plain_10);
      display.setTextAlignment(TEXT_ALIGN_CENTER);
      String msg = String(message);
      if (msg.length() > 21) {
        int splitPos = msg.lastIndexOf(' ', 21);
        if (splitPos == -1) splitPos = 21;
        display.drawString(64, 4, msg.substring(0, splitPos));
        display.drawString(64, 18, msg.substring(splitPos + 1));
      } else {
        display.drawString(64, 11, msg);
      }
      display.display();
      delay(2000);
    } else if (httpCode == 404) {
      display.clear();
      display.setFont(ArialMT_Plain_10);
      display.setTextAlignment(TEXT_ALIGN_CENTER);
      String msg = String(message);
      if (msg.length() > 21) {
        int splitPos = msg.lastIndexOf(' ', 21);
        if (splitPos == -1) splitPos = 21;
        display.drawString(64, 4, msg.substring(0, splitPos));
        display.drawString(64, 18, msg.substring(splitPos + 1));
      } else {
        display.drawString(64, 11, msg);
      }
      display.display();
      delay(2000);
    } else if (httpCode == -1) {
      display.clear();
      display.setFont(ArialMT_Plain_10);
      display.setTextAlignment(TEXT_ALIGN_CENTER);
      display.drawString(64, 4, "Internal Server");
      display.drawString(64, 18, "ERROR");
      display.display();
      delay(2000);
    } else {
      display.clear();
      display.setFont(ArialMT_Plain_10);
      display.setTextAlignment(TEXT_ALIGN_CENTER);
      display.drawString(64, 4, "HTTP ERROR:");
      display.drawString(64, 18, String(httpCode));
      display.display();
      delay(2000);
    }
    
    http.end();
  }
}

void connectToWiFi() {
  display.clear();
  display.setFont(ArialMT_Plain_10);
  display.setTextAlignment(TEXT_ALIGN_CENTER_BOTH);
  display.drawString(64, 16, "Initializing");
  display.display();
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("Connected to");
    Serial.println(ssid);
    display.clear();
    display.setFont(ArialMT_Plain_10);
    display.setTextAlignment(TEXT_ALIGN_CENTER_BOTH);
    display.drawString(64, 16, "Connected to :" + String(ssid));
    display.display();
  } else {
    display.clear();
    display.setFont(ArialMT_Plain_10);
    display.setTextAlignment(TEXT_ALIGN_CENTER_BOTH);
    display.drawString(64, 8, "Failed to connect");
    display.drawString(64, 20, "to Wi-Fi");
  }

  display.display();
  delay(2000);
}