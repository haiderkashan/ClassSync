<p align="center">
  <img src="assets/icon.png" width="96" height="96" alt="ClassSync Logo" style="border-radius: 24px;" />
</p>

<h1 align="center">ClassSync</h1>

<p align="center">
  <strong>The Autonomous, Peer-Orchestrated Academic Timetable & Cohort Synchronization Engine</strong>
</p>

<p align="center">
  <a href="https://github.com/haiderkashan/ClassSync/actions"><img src="https://img.shields.io/badge/build-passing-brightgreen?style=flat-square" alt="Build Status" /></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-277%2F277%20passing-brightgreen?style=flat-square" alt="Test Status" /></a>
  <a href="#"><img src="https://img.shields.io/badge/typescript-strict%20v6.0-blue?style=flat-square" alt="TypeScript Strict" /></a>
  <a href="https://expo.dev"><img src="https://img.shields.io/badge/expo-SDK%2057-black?style=flat-square&logo=expo" alt="Expo SDK 57" /></a>
  <a href="https://reactnative.dev"><img src="https://img.shields.io/badge/react--native-0.86-61DAFB?style=flat-square&logo=react" alt="React Native" /></a>
  <a href="https://supabase.com"><img src="https://img.shields.io/badge/supabase-PostgreSQL%2015-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" /></a>
  <a href="https://clerk.com"><img src="https://img.shields.io/badge/auth-clerk%20core%203-6C47FF?style=flat-square&logo=clerk" alt="Clerk" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-purple?style=flat-square" alt="License" /></a>
</p>

---

## 🌟 Executive Overview

**ClassSync** is an enterprise-grade, mobile-first academic platform engineered for higher-education students and academic cohort representatives worldwide. Designed to replace chaotic WhatsApp broadcast groups and outdated institutional portals, ClassSync provides sub-second timetable updates, decentralized peer cancellation verifications, and 100% offline schedule availability.

Built with an offline-first **Dual-Tier Storage Architecture** (Local SQLite L2 + Cloud Supabase PostgreSQL L3) and an in-memory reactive state layer (Zustand L1), ClassSync guarantees instant app boot times (<100ms) and seamless navigation even in underground auditorium basements without cellular connectivity.

---

## 🚀 Key Architectural Pillars & Features

### 1. 🔄 Bi-Weekly Parity Engine & Timetable Builder
- **Alternating A/B Cycles:** Full mathematical parity calculation supporting `standard_weekly` and `alternating_ab` (Week A / Week B) schedules common across European, UK, North American, and Australian universities.
- **Academic Break Freezing:** Anchor-shifting algorithm that dynamically freezes parity cycles during spring breaks, holidays, and examination weeks.
- **Soft-Clash Conflict Detection:** Real-time interval intersection math ($\max(S_1, S_2) < \min(E_1, E_2)$) alerting Class Representatives of overlapping sessions while allowing split-lab exceptions.

### 2. ⚡ Offline-First SQLite Queue & Battery-Aware Replay Worker
- **Two-Tier Relational Storage:** All schedules, attendance records, tasks, and settings are cached locally in an on-device SQLite database with write-ahead logging (`journal_mode = WAL`).
- **Durable FIFO Mutation Queue:** Actions performed while offline (attendance logging, personal task updates) are committed atomically to SQLite and queued with RFC 4122 v4 client UUIDs.
- **Battery-Aware Sync Worker:** Listens to `NetInfo` and `AppState` to replay queued mutations with exponential backoff only when network reachability is confirmed, preventing battery drain in dead zones.
- **Realtime Write-Through:** Incoming Supabase WebSocket events write directly to SQLite, ensuring cloud updates survive device reboots.

### 3. 🗳️ Decentralized Crowd-Sourced Consensus Engine
- **The Absent CR Solution:** Solves the critical bottleneck when an instructor fails to appear and the Class Representative is absent or unresponsive.
- **Server-Side Temporal Gate:** Submissions are validated strictly in PostgreSQL within $[-10\text{m}, +30\text{m}]$ of class start using server `now()`, preventing client clock spoofing.
- **2x Denial Quorum Math:** Auto-cancels classes only when consensus satisfies $\text{Affirmations} \ge 3 \land \text{Affirmations} > 2 \times \text{Denials}$, mathematically weighting physical instructor observations over premature claims.
- **Administrative CR Veto:** Designated cohort representatives retain the authority to veto false peer reports with a single tap.

### 4. 📽️ Auditorium Presenter HUD & Universal QR Joining
- **Presenter Projection Mode:** A high-contrast display designed for projection screens in lecture halls, showing large rotating QR join codes and live attendee counters.
- **Web-Guarded Hardware Abstraction:** Maximizes screen brightness (`expo-brightness`) and activates keep-awake locks (`expo-keep-awake`) without triggering invasive Android `WRITE_SETTINGS` permissions or crashing web bundlers.
- **Deep-Link Token Preservation:** Universal links (`https://classsync.app/join?code=XYZ123`) and custom scheme URIs preserve target join codes across OAuth browser redirects via Zustand persistent storage.

### 5. 📊 1-Tap Attendance Tracking & Bunk Calculator
- **Frictionless Logging:** 1-tap Present / Absent / Late pills unlocked only after lecture commencement.
- **Bunk & Recovery Analytics:** Real-time percentage tracking against institutional minimum attendance thresholds (e.g. 75%), calculating exact allowable skips or recovery lectures required.

### 6. 🌙 Smart Quiet Hours & Push Routing
- **Contextual Notification Routing:** Background and killed-state notifications route directly to relevant agenda screens via `useNotificationRouting`.
- **Smart Quiet Hours:** Automatically silences non-urgent deadline reminders between 10:00 PM and 7:00 AM while immediately permitting emergency room changes and same-day cancellations to bypass.

### 7. 🛡️ Store Launch Hardening & Apple 5.1.1(v) Safeguard
- **Genesis CR Orphan Guard:** Multi-tiered safeguard blocking account deletion if the user is the creator of an active section, preventing cohort orphaning and forcing ownership delegation first.
- **Atomic Deletion RPC:** Database transaction purging user profiles, enrollments, attendance, and push tokens, followed by Clerk authentication revocation and local SQLite database eviction.
- **Apple Privacy Manifest:** Fully compliant `PrivacyInfo.xcprivacy` declaring `NSPrivacyTracking: false` and officially documented Required Reason APIs.
- **Android Notification Channels:** High-priority channel segregation (`urgent-class-alerts`, `academic-deadlines`, `cohort-announcements`) adhering to Android 8+ and Google Play policies.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLASSSYNC CLIENT ENGINE                         │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 1: Zustand In-Memory State (Microsecond UI Reactivity)          │
│  Layer 2: Expo SQLite On-Device Storage (Durable WAL Relational Cache) │
│  Layer 3: Battery-Aware FIFO Mutation Replay Queue                     │
└───────────────────▲────────────────────────────────┬───────────────────┘
                    │ Realtime WebSockets            │ Background Replay
                    │ & Delta Sync (updated_at)      │ & RPC Invocation
┌───────────────────┴────────────────────────────────▼───────────────────┐
│                       SUPABASE POSTGRESQL 15                           │
├────────────────────────────────────────────────────────────────────────┤
│  • Strict Row Level Security (RLS) via Clerk JWT (auth.jwt() ->> 'sub')│
│  • Atomic PL/pgSQL RPCs (Quorum Consensus, Account Deletion Engine)    │
│  • Database Triggers & Tombstone Deletion Auditing                     │
└───────────────────┬────────────────────────────────────────────────────┘
                    │ Database Webhook Triggers
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    HIGH-AVAILABILITY PUSH DISPATCHER                   │
│         Expo Push Gateway ──► Apple APNs (.p8) / Google FCM v1         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Core Framework** | React Native `0.86.3` / Expo SDK `57.0.24` | Modern mobile runtime with Hermes engine |
| **Routing** | Expo Router `v4` (`expo-router`) | Type-safe file-based navigation |
| **Styling** | NativeWind `v4` (`tailwindcss@^3.4.19`) | Tailwind CSS utility-first mobile styling |
| **Authentication** | Clerk Expo SDK (`@clerk/expo` Core 3) | Google & Apple OAuth identity provider |
| **Cloud Database** | Supabase (`@supabase/supabase-js`) | PostgreSQL 15, RLS policies, Realtime channels |
| **Local Database** | Expo SQLite (`expo-sqlite` `~57.0.3`) | ACID on-device cache with WAL journaling |
| **State & Cache** | Zustand `v5` + TanStack React Query `v5` | In-memory sync + asynchronous server cache |
| **Hardware APIs** | Expo Camera, Brightness, KeepAwake | Web-guarded native hardware integrations |
| **Build & Deploy** | Expo Application Services (EAS) | Automated cloud build and submission pipeline |

---

## 📁 Repository Structure

```
ClaasSync/
├── __tests__/                  # Unit & E2E integration test suites (277 tests)
├── assets/                     # Adaptive icons, splash screens, favicons
├── docs/                       # Architectural specifications & documentation
│   ├── legal/                  # Hosted Privacy Policy, Terms, Support HTML
│   ├── ARCHITECTURE.md         # Database DDL, RLS, and security specs
│   ├── LAUNCH_CHECKLIST.md     # Production release execution guide
│   ├── PRODUCTION_PUSH_CREDENTIALS.md # APNs & FCM setup runbook
│   └── PRD.md                  # Global Product Requirements Document
├── src/
│   ├── app/                    # Expo Router file-based screens and modals
│   │   ├── (auth)/             # Authentication stack (Sign-In)
│   │   ├── (tabs)/             # Bottom tab navigator (Agenda, Tasks, Settings)
│   │   ├── attendance/         # Course analytics & bunk calculator modals
│   │   ├── schedule/           # Timetable builder, class edit, Presenter HUD
│   │   ├── tasks/              # Academic task creation modal
│   │   └── _layout.tsx         # Root error boundary, providers & splash guard
│   ├── components/             # Reusable UI component library (Stitch design)
│   ├── hooks/                  # Custom React hooks (Workspaces, Deletion, Attendance)
│   ├── lib/                    # Core libraries (Database, Sync, Notifications, Env)
│   ├── providers/              # Root Clerk & QueryClient provider tree
│   ├── services/               # Pure business logic services (Channels, Deletion, Quorum)
│   ├── store/                  # Zustand global store slices with partialize whitelist
│   └── types/                  # Generated Supabase database TypeScript definitions
├── app.json                    # Expo project configuration & Apple Privacy Manifest
├── eas.json                    # EAS build profiles (development, preview, production)
├── metro.config.js             # NativeWind & production minifier log stripping
└── tailwind.config.js          # Brand color tokens and typography scale
```

---

## 🛠️ Quick Start & Local Development

### Prerequisites
- Node.js `v20.x` or higher
- npm or yarn
- Expo Go app on iOS / Android or physical device / simulator

### Installation
```bash
# Clone the repository
git clone https://github.com/haiderkashan/ClassSync.git
cd ClassSync

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
```

### Environment Variables (`.env.local`)
```ini
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJh...
```

### Running the App
```bash
# Start the Metro bundler
npx expo start

# Run on Android emulator / physical device
npx expo run:android

# Run on iOS simulator / physical device
npx expo run:ios

# Run web preview
npx expo start --web
```

---

## 🧪 Verification & Testing Suite

ClassSync maintains a zero-tolerance policy for compiler errors and test regressions.

```bash
# Execute full Jest test suite (24 suites, 277 passing tests)
npm test

# Run strict TypeScript compilation check (0 errors)
npx tsc --noEmit

# Verify web export bundle integrity (3,351 modules cleanly bundled)
npx expo export --platform web
```

---

## 🚢 Production Build & App Store Submission

ClassSync utilizes EAS (Expo Application Services) for automated compilation of production binaries:

```bash
# Build production Android App Bundle (.aab) & iOS Archive (.ipa)
npx eas build --profile production --platform all

# Generate standalone Android APK for physical device QA
npx eas build --profile preview --platform android

# Submit production binaries directly to stores
npx eas submit --platform all
```

Refer to [`docs/LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md) for the complete pre-flight store submission procedure.

---

## 📄 License & Attribution

ClassSync is open-source software licensed under the [MIT License](LICENSE).  
Copyright &copy; 2026 ClassSync. All rights reserved.
