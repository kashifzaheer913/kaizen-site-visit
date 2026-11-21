# Kaizen Site Visit App

Multi-user app: har banda apni Google ID se login karta hai aur sirf apna data dekhta hai.
Export ki hui file ka naam login wale ke naam par banta hai.

## Setup (ek dafa)

### 1. Google Cloud (OAuth Client IDs)
console.cloud.google.com > naya project > APIs & Services > OAuth consent screen (External, app name Kaizen, apni email) > **Publish app** (warna sirf test users login kar sakenge).
Credentials > Create credentials > OAuth client ID, 2 banayen:
- **Web application** (koi redirect URL nahi chahiye). Iski Client ID copy karein -> yehi `CLIENT_ID` hai.
- **Android**: Package name `com.kaizen.sitevisit`, SHA-1 `C3:C1:D3:BA:B0:2F:D5:86:CB:B5:83:72:F1:0D:AE:2B:D6:16:77:24` (resources/debug.keystore ki).

### 2. Google Sheet + Apps Script
1. Sheet > Extensions > Apps Script > `apps-script/Code.gs` paste karein, upar `CLIENT_ID` me Web Client ID daalein.
2. Editor me `setup` function ek dafa run karein (permissions allow).
3. Deploy > Manage deployments > Edit > New version (ya New deployment: Execute as **Me**, Access **Anyone**).

### 3. App
Web Client ID **3 jagah** paste karein (same value):
- `www/config.js` -> `clientId` (aur `url` me Web App URL)
- `capacitor.config.json` -> `plugins.GoogleAuth.serverClientId`
- `apps-script/Code.gs` -> `CLIENT_ID`

Phir GitHub par push karein (main branch), Actions APK bana deta hai. Releases se `Kaizen-Site-Visit.apk` download karke install karein.

## Features
Add / edit / delete, City field (Pakistan ke cities/towns search), Today city button, multi-select (long press), filters (date, size, type, city), Excel & PDF export, offline sync, smart back button.
