# محجوز (Mahjooz) — منصة الحجوزات والخدمات الشاملة

## Project Overview
Mahjooz is a multi-sided service and booking platform targeting the Yemen/Middle East market. It connects Customers, Vendors, Drivers, Staff, and Admins across a wide range of services: hotels, car rentals, flights, medical appointments, professional services (plumbing, electrical, beauty, photography), pharmacies, and digital products.

## Tech Stack
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 — Single Page Application (SPA)
- **Build Tool:** Vite 5
- **Backend/Database:** Firebase v8 (Firestore NoSQL, Firebase Auth, Firebase Messaging)
- **Maps:** Google Maps API (live tracking) + Mapbox GL JS (location pickers)
- **Charts:** Chart.js (admin/vendor analytics)
- **Reports:** html2canvas + jsPDF (invoices)
- **Package Manager:** pnpm

## Running the App
```
pnpm --filter @workspace/mahjooz run dev
```
Dev server runs on port 5000.

## Project Structure
- `index.html` — single HTML entry point, loads all scripts
- `src/js/core/` — Firebase config, i18n, core state/router
- `src/js/features/` — main pages and dashboards
- `src/js/modules/` — domain modules (admin, payments, tracking, loyalty, etc.)
- `src/styles/` — component-based CSS

## Key Configuration
- Firebase project: `mahjooz-b502f`
- Firebase config is in `src/js/core/firebase-config.js`
- Vite config: `vite.config.ts` (port from `PORT` env var, defaults to 5173)
- The dev script hardcodes `--port 5000` which overrides the vite config PORT logic

## User Preferences
- Keep the existing Firebase Auth and Firestore setup — do not replace with Replit Auth
- Preserve all existing module structure and file organization
- The app is an Arabic-first RTL application
