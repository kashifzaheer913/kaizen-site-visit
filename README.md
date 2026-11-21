# Kaizen Site Visit App (multi user)

Har user apni email se login karta hai aur sirf apna data dekhta hai. Sab ka data + backup aap ki ek master Google Sheet me rehta hai.

## Setup (ek dafa)
1. Master Google Sheet > Extensions > Apps Script > `apps-script/Code.gs` paste karein.
2. Function `setup` Run karein (permissions Allow). Isse `Data`, `Backup` aur do hidden tabs ban jate hain.
3. Deploy > New deployment > Web app: Execute as = **Me**, Who has access = **Anyone**. (Update ke liye: Manage deployments > Edit > New version.)
4. Web App URL `www/config.js` me paste karein.
5. Folder GitHub (main branch) par push karein. Actions APK bana deta hai (Releases page).

## Purana data (optional)
Apps Script me `importOldSheet` me apni email likh kar Run karein. Purani `Sheet1` ka data us email ke naam par `Data` tab me aa jata hai.

## Login
Email -> 6-digit code email par -> login. Koi Google OAuth / Cloud setup nahi.
`ALLOWED_EMAILS` (Code.gs) me emails likh kar login limit kar sakte hain.

## Features
Today City button (us din ki nayi entries me city auto), city search (Pakistan ke cities/towns), add / edit / delete, multi-select, filters (city bhi), Excel & PDF export (file ka naam user ke naam se).
