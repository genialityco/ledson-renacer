# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Led's on Renacer" — an event photobooth/booking system for Galería Renacer. A user books a time slot, takes a photo with their webcam, pays online, the backend stylizes the photo through an external AI generation API, and the result is projected on a big screen at the scheduled minute, then sent to the user by email and WhatsApp.

Monorepo with two independent Node apps (no workspace tooling, each has its own `package.json`):

- `frontend/` — React 19 + Vite + TypeScript + Mantine UI
- `backend/` — NestJS + Firebase Admin (Firestore + Storage)

Comments, UI strings, and emails are in Spanish (with EN variants via i18n).

## Commands

Backend (run from `backend/`):

```bash
npm run start:dev          # dev server with watch, port 5000 (PORT env)
npm run build              # nest build
npm run lint               # eslint with --fix
npm test                   # jest (*.spec.ts under src/)
npm test -- app.controller # run a single test file by name pattern
npm run test:e2e           # e2e tests (test/jest-e2e.json)
```

Frontend (run from `frontend/`):

```bash
npm run dev                # vite dev server (host: true, LAN-exposed)
npm run build              # tsc -b && vite build
npm run lint               # eslint
```

There is no frontend test setup.

### Required local setup

- `backend/sured-883e9-firebase-adminsdk.json` — Firebase Admin service-account key, loaded from the backend root at startup (gitignored). Without it Firebase silently fails to init.
- Environment variables live in files literally named `env` (no dot) in `backend/` and `frontend/`; `.env` is gitignored. NestJS `ConfigModule.forRoot()` and Vite read `.env`, so copy `env` → `.env` locally. Backend vars: Wompi keys (`WOMPI_ENV`, `WOMPI_PRIVATE_KEY_*`, `WOMPI_INTEGRITY_SECRET_*`), AWS SES (`AWS_*`), WhatsApp (`WHATSAPP_API_URL`, `WHATSAPP_ACCOUNT_ID`), dLocal Go (`DLOCALGO_API_KEY/SECRET`). Frontend: `VITE_WOMPI_PUBLIC_KEY`.
- External AI image API is expected at `http://localhost:8000/generate` (multipart: `lora`, `prompt`, `lora_strength`, `denoise`, `image`). If it's down, the backend falls back to projecting the original photo.

## Architecture

### Data model (Firestore, no ORM — documents are untyped `any`)

All access goes through `FirebaseService` (`backend/src/firebase/firebase.service.ts`), which exposes raw Firestore/Storage handles. Collections are prefixed `lr_`:

- `lr_bookings` — one doc per booking. Status lifecycle: `PENDING` → `APPROVED` → `GENERATED` → `SHOWN` → `COMPLETED`.
- `lr_filters` — AI style filters (LoRA name, prompt, strength, transition effect, frame overlay). Managed by the `images` module; seeded on startup.
- `lr_settings` — singleton config docs: `screen` (big-screen layout, carousel, deadTimes, and `currentProjection` — the live projection pointer), `schedules` (`slotDuration`, `bookingSystemType`, `paymentGateway`), `general` (email language).
- `lr_slot_templates`, `lr_daily_schedules` — reusable schedule templates and per-date (`YYYY-MM-DD`) schedules with `deadTimes`.

Photos live in Firebase Storage (`bookings/`, `generated/`); files are made public with a long-lived signed-URL fallback.

### Booking flows (bookings.service.ts is the core of the system)

Two entry paths, both under `/api/bookings`:

1. **Self-service with online payment**: `POST /init` creates a `PENDING` booking → frontend pays via Wompi widget or dLocal Go redirect → `POST /:id/confirm-payment` verifies, assigns the exact projection minute, sets `APPROVED`, and kicks off image generation in the background.
2. **Assisted (admin/point-of-sale)**: `POST /api/bookings` creates the booking directly as `APPROVED` (cash/dataphone/QR payment methods).

Two scheduling modes, switched by `lr_settings/schedules.bookingSystemType`:

- `slots`: user picks a time range (`timeSlot: "HH:MM-HH:MM"`); backend assigns the first free minute inside it, skipping `deadTimes`, at `slotDuration` intervals. `exactTime` becomes `"Agotado/Lleno"` if full.
- `queue`: date is forced to today and `exactTime` is auto-assigned after the latest existing booking (or now), aligned to `slotDuration`.

Note: the exact-time assignment logic is duplicated across `initBooking`, `confirmPayment`, and `createBooking` — a change to slot logic usually needs to be made in all three.

### Cron jobs (in BookingsService, via @nestjs/schedule)

- Every minute: auto-project `GENERATED` bookings whose `exactTime` has arrived (5-min tolerance window), and send WhatsApp "your projection is coming up" notifications (10-min lookahead).
- Every 10 minutes: abandoned-cart emails for bookings `PENDING` > 15 minutes.

### Big screen (the projection loop)

`frontend/src/BigScreenView.tsx` (route `/screen`, renders without the app shell) polls `GET /api/bookings/screen-settings` every 3 s. "Projecting" means the backend writes `currentProjection` into `lr_settings/screen`; the screen displays it, and when `projectionDuration` elapses the screen calls `POST /api/bookings/:id/complete`, which clears the projection, sends the result email (AWS SES) and WhatsApp message, and marks the booking `COMPLETED`. When idle, the screen shows a carousel/content grid from the same settings doc.

Offline resilience: the last screen settings are kept in localStorage; key media (loop video, default image, transition video) are stored locally via `useCachedAsset` (Cache API — requires CORS on the Storage bucket, set with `npx ts-node scripts/set-storage-cors.ts`); and `public/screen-sw.js`, registered only by BigScreenView, caches the app so `/screen` reloads without internet. Cache API and service workers only work in a secure context (https or `localhost`), not on `http://<LAN-IP>`.

### Payments

- **Wompi** (`wompi/`): backend only computes the integrity signature (`GET /api/wompi/integrity-signature`) and verifies transactions; the widget runs client-side. Sandbox vs production via `WOMPI_ENV`.
- **dLocal Go** (`dlocalgo/`): backend creates a redirect payment link and polls status. Currently hardcoded to the sandbox base URL.
- Active gateway is chosen by `lr_settings/schedules.paymentGateway`.

### Auth

Firebase Auth (email/password) with a `role` custom claim: `admin` (everything) or `vendedor` (assisted booking only). Accounts are managed from the admin "Usuarios" tab (`UsersAdmin.tsx` → `backend/src/users/`, `@Roles('admin')`); passwords are never set there — Firebase's password-reset email is used both for new users and "forgot password". The first admin is bootstrapped with `npx ts-node scripts/set-user-role.ts <email> admin [password]` from `backend/`. The guard verifies tokens with `checkRevoked`, so disabling a user or changing their role (which revokes sessions) takes effect immediately.

- Backend: global `AuthGuard` (`backend/src/auth/`) only enforces endpoints decorated with `@Roles(...)`; **undecorated endpoints are public**, so new admin endpoints must add `@Roles('admin')`. `admin` always passes.
- The big screen doesn't log in: `/complete` and `grid-item-shown` use `@Roles('screen')`, satisfied by header `X-Screen-Key` = `SCREEN_KEY` env. Open the screen as `/screen?key=<SCREEN_KEY>` (remembered in localStorage).
- Frontend: `firebaseAuth.ts` registers a global axios interceptor that adds the ID token to requests to `API_BASE_URL`. `RequireRole` (`auth.tsx`, lazy-loaded so Firebase stays out of public bundles) guards `/admin/*` and `/assisted-booking`; login at `/login`.

### Frontend structure

Flat `src/` — one file per view, no folders. Routes are defined in `App.tsx`: `/` (Home), `/booking` (self-service), `/assisted-booking`, `/my-bookings`, `/admin` + `/admin/grid` + `/admin/bookings-calendar`, `/screen`. i18n is a hand-rolled ES/EN context in `i18n.tsx` (`useLanguage()` / `t()`).

API base URL `http://localhost:5000` is hardcoded in every axios call (BigScreenView uses `window.location.hostname` instead) — there is no env-based API URL; changing the backend host means touching every view file.
