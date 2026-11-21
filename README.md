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

## Web app (APK ke bajaye, Play Protect ka masla nahi)
1. GitHub repo > Settings > Pages > Source: **GitHub Actions**. Push par app khud deploy hoti hai.
2. Link: `https://<github-username>.github.io/<repo-name>/`
3. Google Cloud > Credentials > Kaizen Web > **Authorized JavaScript origins** > Add URI: `https://<github-username>.github.io` (sirf itna, aage path nahi).
4. Phone ke Chrome me link kholen > menu (3 dots) > **Install app** / **Add to Home screen**. Icon se normal app ki tarah khulti hai, updates khud aate hain.

## Play Store (Play Protect warning ke baghair install)
1. GitHub > Settings > Secrets and variables > Actions me 4 secrets daalein (KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_PASSWORD, KEY_ALIAS). Push ke baad Actions se `Kaizen-Play-Store-AAB` artifact download karein.
2. play.google.com/console (ek dafa $25) > Create app > Testing > **Internal testing** > Create release > App signing: Play App Signing on > AAB upload > testers ki Gmail IDs add > opt-in link sab ko bhejein.
3. Play Console > Setup > **App signing** me "App signing key certificate" ka SHA-1 copy karein. Google Cloud > Create OAuth client > Android, package `com.kaizen.sitevisit`, wo SHA-1 paste karein (aur upload key wala SHA-1 bhi ek alag client me). Warna Play wali app me Google login "Developer error" dega.
