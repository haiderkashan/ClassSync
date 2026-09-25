# ClassSync — Phase 8 Manual QA Protocol (`docs/PHASE_8_MANUAL_QA.md`)

> **Target Phase:** Phase 8 (High-Value Global Features & Consensus Engine)  
> **Environment:** Physical Mobile Devices (iOS via TestFlight / Expo Go, Android via APK / Expo Go)  
> **Purpose:** Verify hardware-dependent capabilities (Camera, Screen Brightness, Keep-Awake, Orientation Lock) and decentralized multi-client real-time WebSocket consensus that cannot be exercised in synthetic or web emulator environments.

---

## Pre-Requisites & Test Device Setup

To thoroughly execute this protocol, prepare:
1. **Device A (Class Admin / Genesis CR):** Physical iPhone or Android device logged in as the section creator / CR.
2. **Device B (Student 1):** Physical device logged in as an enrolled cohort student.
3. **Device C (Student 2) & Device D (Student 3):** Additional physical devices or parallel simulator sessions logged in as cohort members.
4. **Network:** Wi-Fi or cellular data connectivity. (Airplane mode will be tested on Device B).

---

## Protocol 1: Presenter HUD, Display Brightness & Keep-Awake

### 1.1 Objective
Verify that the Class Representative can project their section join QR code in a large auditorium hall without screen sleep, orientation flipping, or Android permission crashes, while providing instant maximum brightness.

### 1.2 Step-by-Step Execution

1. **Pre-Condition (Brightness Baseline):**
   - On **Device A**, open the OS system settings or control center and drag display brightness down to approximately **25%–30%**.
2. **Launch Presenter HUD:**
   - In ClassSync, navigate to **Settings** (`/settings`) -> scroll to **Enrolled Section** -> tap **"Project Cohort QR"** (or open `/schedule/presenter-hud`).
3. **Verify Brightness Boost:**
   - Observe the physical screen brightness. It MUST immediately and smoothly ramp up to **100% maximum brightness**.
   - *Android Security Check:* Verify that NO system permission dialog (`WRITE_SETTINGS`) appeared. (App-level brightness must work cleanly).
4. **Verify Display Keep-Awake:**
   - Temporarily set your device screen lock timeout to **30 seconds** in OS Settings.
   - Leave Device A on the table on the Presenter HUD screen without touching it for **90 seconds**.
   - *Pass Criteria:* The screen remains fully lit and does not dim or lock.
5. **Verify Orientation Lock:**
   - Physically rotate Device A into landscape mode.
   - *Pass Criteria:* The Presenter HUD remains strictly locked in portrait mode (`PORTRAIT_UP`) without layout distortion or rotation.
6. **Verify Brightness Restoration on Exit:**
   - Tap the close button `(X)` or swipe back to dismiss the Presenter HUD.
   - *Pass Criteria:* Physical screen brightness immediately drops back to your original **25%–30%** baseline.
7. **Verify Realtime Joined Students Counter:**
   - Re-open the Presenter HUD on Device A. Observe the attendee pill: `👥 X Students Joined`.
   - On Device B, scan the QR code and join the section.
   - *Pass Criteria:* Within **<1 second**, the counter on Device A increments to `👥 X+1 Students Joined` automatically via Supabase Realtime without manual refresh.

---

## Protocol 2: Universal Deep-Links & In-App CameraView Scanner

### 2.1 Objective
Verify that students can onboard seamlessly by scanning the presenter's QR code with the native camera scanner, tapping universal web links, or deep linking through OAuth redirects.

### 2.2 Step-by-Step Execution

1. **OS Camera Permission Flow:**
   - On **Device B**, open ClassSync and tap **"Join a Section"** on the Agenda empty state (or Settings).
   - In the Join modal, tap the **"Scan QR Code"** button.
   - *First-Run Prompt:* Verify that the native iOS/Android camera permission dialog appears:  
     `"ClassSync would like to access your camera to scan section join QR codes."`
2. **Test Permission Denial Recovery:**
   - Tap **"Don't Allow" / "Deny"**.
   - *Pass Criteria:* The app MUST NOT crash or show a blank black view. An interactive recovery card must render:  
     `"Camera Access Required"` with a **"Grant Permission"** button.
   - Tap **"Grant Permission"** and enable camera access in device settings.
3. **Verify Camera Scanning & Haptics:**
   - Return to ClassSync. The active camera viewfinder appears with a rounded targeting reticle.
   - Point the camera at Device A's Presenter HUD QR code.
   - *Pass Criteria:*
     - The camera instantly detects the QR code (`onBarcodeScanned`).
     - Device vibrates/triggers haptic feedback.
     - The modal extracts the 6-character code (`parseJoinCodeFromUrl`) into the input field and automatically submits `join_section_via_code`.
     - Device B transitions directly to the populated section timetable.
4. **Test Universal Web Links & Custom Schemes:**
   - Open Safari or Chrome on Device B.
   - Navigate to: `https://classsync.app/join?code=ABC123` (or enter `classsync://join?code=ABC123` in notes/browser).
   - *Pass Criteria:* The OS prompts to open ClassSync, and the app routes directly to the section join modal with the code pre-filled.
5. **Test OAuth Redirect Survival:**
   - Sign out of ClassSync on Device B.
   - Tap a join link `classsync://join?code=ABC123` from an external app.
   - The app opens on the Sign-In screen. Tap "Sign in with Google" or "Sign in with Apple".
   - Complete the browser authentication.
   - *Pass Criteria:* Once redirected back to ClassSync, `pendingJoinCode` is restored from Zustand `partialize` (AsyncStorage), and the app immediately displays the Join Section confirmation for `ABC123` rather than stranding the user on the home screen.

---

## Protocol 3: Crowd-Sourced Peer Verification Consensus Engine

### 3.1 Objective
Verify the decentralized consensus engine: server-side temporal validation, strict offline queue bypass, asymmetric 2x denial weighting, automated override creation, and CR administrative veto.

### 3.2 Step-by-Step Execution

#### Step A: Temporal Reporting Gate Validation
1. Create or select a class session scheduled for **10:00 AM**.
2. **Test Early Reporting Gate (>10 mins before):**
   - At 09:45 AM, inspect the class card on the Agenda tab.
   - *Pass Criteria:* The "Report Class" CTA indicates reporting unlocks 10 minutes before class start (`09:50 AM`). Submitting earlier is rejected by the server RPC `cast_peer_vote`.
3. **Test Open Window (-10 mins to +30 mins):**
   - At 09:55 AM, tap the class card. The "Report Absent Professor" / "Report Cancellation" modal opens with voting options.
4. **Test Window Expiration (>30 mins after start):**
   - After 10:30 AM, verify that peer reporting for the 10:00 AM class is closed.

#### Step B: Strict Offline Queue Bypass Verification
1. On **Device B**, enable **Airplane Mode** (disable Wi-Fi and Cellular data).
2. Tap the class card -> tap **"Confirm Cancelled"**.
3. *Pass Criteria:*
   - The app MUST immediately display an error: `"Offline: Peer verification requires an active internet connection"`.
   - The vote **MUST NOT** be queued into the Phase 7 `offline_mutations` SQLite table. (Verify that turning Airplane Mode off later does NOT submit a stale vote).

#### Step C: Consensus Quorum & 2x Denial Weighting
1. **Vote 1 (First Affirmation):**
   - On **Device B**, reconnect to the internet and tap **"Confirm Cancelled"**.
   - *Result:* An active report is opened in `peer_schedule_reports`. The class card on Device B turns **amber** with an alert banner:  
     `"Peer Cancellation Reported (1 affirmation, 0 denials)"`.
2. **Realtime Broadcast to Cohort:**
   - Inspect **Device A (CR)** and **Device C (Student 2)**.
   - *Result:* Without manual pull-to-refresh, both devices update to the amber alert banner within **<1 second** via Supabase Realtime WebSocket subscriptions.
3. **Vote 2 (Denial Weighting Test):**
   - On **Device C**, open the voting modal and tap **"Deny: Class In Session"**.
   - *Result:* Live counter updates across all devices to:  
     `"1 affirmation, 1 denial"`.
   - Quorum rule requires: $\text{Affirmations} \ge 3 \land \text{Affirmations} > (2 \times \text{Denials})$.
   - Here: $1 \ge 3$ (False) and $1 > 2$ (False). The class remains active.
4. **Vote 3 & 4 (Affirmations Catch-Up):**
   - On **Device D**, submit an affirmation -> `"2 affirmations, 1 denial"`. ($2 \ge 3$ False).
   - On a 4th student session, submit an affirmation -> `"3 affirmations, 1 denial"`.
   - Quorum test: $3 \ge 3$ (True), and $3 > (2 \times 1 = 2)$ (**True!**).
5. **Automated Override Creation:**
   - The moment the 3rd affirmation satisfies the formula, the Postgres RPC `cast_peer_vote` atomically inserts a row into `schedule_overrides` with `status = 'cancelled'`.
   - *Pass Criteria:* All devices instantly update. The class card turns **red** with a strikethrough and a verified badge:  
     `"Cancelled: Peer Verified Cancellation"`.

#### Step D: Genesis CR Administrative Veto
1. On **Device A** (logged in as the Genesis CR or Co-Admin), tap the cancelled class card.
2. Observe the CR Administrative panel at the bottom: **"CR Administrative Veto"**.
3. Tap **"Veto Peer Report"**, enter reason `"Professor arrived 15 mins late"`, and confirm.
4. *Pass Criteria:*
   - The `veto_peer_report` RPC updates the report status to `'vetoed'`.
   - The auto-generated cancellation override is deleted from `schedule_overrides`.
   - All student devices (Device B, C, D) instantly revert in real-time back to the normal scheduled card (`"Scheduled"`).

---

## Phase 8 Manual QA Sign-Off Matrix

| Test Case | Description | Pass Criteria | Result |
| :--- | :--- | :--- | :--- |
| **8-QA-01** | Presenter HUD Auto-Brightness | Screen boosts to 100% on mount; restores baseline on unmount | [ ] PASS |
| **8-QA-02** | Presenter HUD Keep-Awake | Device does not sleep or dim after 90s idle | [ ] PASS |
| **8-QA-03** | Presenter HUD Orientation Lock | Screen stays locked in portrait upon tilting | [ ] PASS |
| **8-QA-04** | Realtime Attendee Counter | Increment counter `X -> X+1` via Realtime when student joins | [ ] PASS |
| **8-QA-05** | Camera Permission Denial | Renders permission recovery card without crash | [ ] PASS |
| **8-QA-06** | CameraView QR Scan & Join | Auto-detects QR, vibrates, fills code, joins section | [ ] PASS |
| **8-QA-07** | Deep-Link OAuth Survival | Join code survives external browser OAuth redirect via Zustand | [ ] PASS |
| **8-QA-08** | Server-Side Temporal Gate | Rejects reports submitted outside $[-10\text{m}, +30\text{m}]$ window | [ ] PASS |
| **8-QA-09** | Offline Queue Bypass | Offline peer votes fail fast and are NOT enqueued in SQLite | [ ] PASS |
| **8-QA-10** | Quorum 2x Denial Math | Quorum requires $\ge 3$ affirmations AND $\text{Aff} > 2 \times \text{Den}$ | [ ] PASS |
| **8-QA-11** | Realtime Consensus Sync | Amber voting banner updates across all cohort devices in <1s | [ ] PASS |
| **8-QA-12** | CR Administrative Veto | CR veto deletes auto-override and restores schedule across cohort | [ ] PASS |
