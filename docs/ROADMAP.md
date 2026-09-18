# ClassSync Granular Development Roadmap (AI-Assisted Workflow)

**Document Version:** 2.0  
**Target Environment:** React Native (Expo SDK 51/52), Supabase, Clerk, Expo Notifications  
**Methodology:** Step-by-step sequential implementation optimized for AI coding agents and human verification at every milestone.

---

## Roadmap Overview & Dependency Graph

```
[Phase 0: Scaffold & Setup] 
        │
        ▼
[Phase 1: Clerk Auth + Supabase JWT Bridge] ──► (Milestone 1: Verified Token Exchange)
        │
        ▼
[Phase 2: Workspaces & Multi-Tenant Enrollment] ──► (Milestone 2: Multi-User Cohort Join)
        │
        ▼
[Phase 3: Base Timetable Builder] ──► (Milestone 3: Recurring Schedule Engine)
        │
        ▼
[Phase 4: Client Compilation & Daily Agenda UI] ──► (Milestone 4: Timezone & A/B Week Render)
        │
        ▼
[Phase 5: Real-Time Live Status Overrides] ──► (Milestone 5: Sub-second WebSocket Sync)
        │
        ▼
[Phase 6: Push Notifications & Quiet Hours] ──► (Milestone 6: Targeted Push Dispatch)
        │
        ▼
[Phase 7: Offline-First SQLite Cache] ──► (Milestone 7: Airplane Mode Launch)
        │
        ▼
[Phase 8: High-Value Global Features] ──► (Milestone 8: Calendar Sync, QR & Peer Verify)
        │
        ▼
[Phase 9: Store Launch Hardening (App Store & Play Store)]
```

---

## Phase 0: Project Scaffold & Developer Environment

### Objective
Initialize the React Native Expo repository with TypeScript, Expo Router, styling system, and local database environment.

### Steps
1. **Initialize Expo App:**
   ```bash
   npx create-expo-app@latest class-sync --template tabs
   ```
2. **Install Core Dependencies:**
   - Routing & Navigation: `expo-router`, `react-native-safe-area-context`, `react-native-screens`
   - UI & Animation: `react-native-reanimated`, `react-native-gesture-handler`, `lucide-react-native`
   - Styling: `nativewind` and `tailwindcss`
   - Data & State: `@tanstack/react-query`, `zustand`
   - Utilities: `date-fns`, `date-fns-tz`
3. **Database Environment:**
   - Link project to Supabase using Supabase CLI:
     ```bash
     npx supabase init
     npx supabase login
     npx supabase link --project-ref <your-supabase-ref>
     ```
4. **Execute Schema Migration:**
   - Run the complete DDL script defined in `docs/ARCHITECTURE.md` as migration `20260918000000_initial_schema.sql`.
   - Apply migrations: `npx supabase db push`.

### Verification & Test Checkpoint
- [ ] App compiles and runs on iOS Simulator and Android Emulator without warnings.
- [ ] Supabase Studio reflects all 11 tables, custom enums, and RLS policies.

---

## Phase 1: Clerk Auth + Supabase JWT Bridge

### Objective
Implement frictionless native authentication (Google Sign-In + Apple Sign-In) with Clerk and establish an authenticated session bridge with Supabase RLS.

### Steps
1. **Install Clerk Expo SDK:**
   ```bash
   npx expo install @clerk/clerk-expo expo-secure-store expo-crypto
   ```
2. **Setup Secure Token Cache:**
   - Create `src/lib/auth/tokenCache.ts` using `expo-secure-store` to persist Clerk sessions securely across app restarts.
3. **Configure Clerk JWT Template for Supabase:**
   - In Clerk Dashboard -> JWT Templates -> New "Supabase" template.
   - Set claims:
     ```json
     {
       "aud": "authenticated",
       "role": "authenticated",
       "sub": "{{user.id}}",
       "email": "{{user.primary_email_address}}"
     }
     ```
4. **Create Supabase Client with Dynamic Clerk Token:**
   - Create `src/lib/supabase/client.ts`.
   - Configure `@supabase/supabase-js` with a custom `accessToken` provider:
     ```typescript
     import { createClient } from '@supabase/supabase-js';

     export const createClerkSupabaseClient = (getToken: () => Promise<string | null>) => {
       return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
         global: {
           fetch: async (url, options = {}) => {
             const token = await getToken();
             const headers = new Headers(options?.headers);
             if (token) headers.set('Authorization', `Bearer ${token}`);
             return fetch(url, { ...options, headers });
           },
         },
       });
     };
     ```
5. **Implement Authentication Screens:**
   - `src/app/(auth)/sign-in.tsx`: OAuth button for Google and Apple Sign-In using Clerk's `useOAuth()`.
   - Auto-sync profile to Supabase `profiles` table upon successful authentication.

### Verification & Test Checkpoint
- [ ] User can sign in via Google / Apple.
- [ ] Clerk session issues a Supabase JWT.
- [ ] Profile row is inserted/verified in Supabase `profiles` table matching `auth.jwt() ->> 'sub'`.
- [ ] Authenticated REST query succeeds against an RLS-protected table.

---

## Phase 2: Workspaces & Multi-Tenant Enrollment

### Objective
Allow Lead Admins to create Cohort Workspaces, and enable Cohort Members & Course Guests to enroll via Join Codes, QR codes, and Deep-Links.

### Steps
1. **Empty State & Routing Guard:**
   - Check if user has existing `workspace_members` or `course_enrollments`.
   - If empty, navigate to `src/app/(onboarding)/welcome.tsx` with options:
     - **Create Cohort**
     - **Join with Code / Scan QR**
2. **Create Workspace Flow:**
   - Screen: `src/app/workspace/create.tsx`
   - Inputs: Cohort Name (e.g., *"Electrical Engineering 2026"*), Institution Tag, Cycle Mode (`standard_weekly` vs `alternating_ab`), and auto-detected IANA Timezone.
   - Generates unique 7-char alphanumeric `join_code` via DB trigger or client helper.
   - Transactionally inserts row into `workspaces` and adds creator into `workspace_members` as `lead_admin`.
3. **Join Workspace by Code Flow:**
   - Screen: `src/app/workspace/join.tsx`
   - Input: 7-character code input with auto-capitalization and validation.
   - Calls Supabase RPC `join_workspace_by_code(code)` which verifies code, inserts into `workspace_members` as `member`, and auto-enrolls user into all active non-archived courses for that workspace in `course_enrollments`.
4. **Single-Course Guest Join Link:**
   - Deep link handler for `/join/course/[guest_invite_token]`.
   - Inserts entry into `course_enrollments` with `membership_type = 'course_guest'`.

### Verification & Test Checkpoint
- [ ] Admin creates "Mechanical 2027"; receives join code `MECH27A`.
- [ ] Second test account enters `MECH27A`; successfully joins cohort and inherits all courses.
- [ ] Third test account clicks a Course Guest Link; enrolls *only* in that course without seeing full cohort data.

---

## Phase 3: Base Timetable Builder (Class Admin)

### Objective
Provide Class Admins with a mobile-optimized visual schedule builder to define recurring weekly courses, rooms, and times.

### Steps
1. **Course Management Subsystem:**
   - Screen: `src/app/courses/index.tsx` & `src/app/courses/new.tsx`.
   - Admin can add Course Code (e.g., *"CS204"*), Course Name (*"Algorithms"*), and pick an accent color from an accessible palette.
2. **Weekly Timetable Grid & Block Editor:**
   - Screen: `src/app/schedule/builder.tsx`.
   - Visual day-selector (Mon - Sun).
   - Class block form:
     - Select Course (picker)
     - Session Type (Lecture, Lab, Tutorial, Seminar, Studio)
     - Start Time & End Time (Native wheel time picker)
     - Room / Hall / Building (text input)
     - Frequency selector (Weekly, Week A Only, Week B Only)
3. **Database Write:**
   - Inserts into `base_schedules` with RLS validation confirming user is `lead_admin` or `co_admin`.

### Verification & Test Checkpoint
- [ ] Admin can add 5 courses with distinct color tags.
- [ ] Admin builds a recurring Monday schedule with 3 classes.
- [ ] Non-admin accounts attempting to write to `base_schedules` are rejected by PostgreSQL RLS.

---

## Phase 4: Client Schedule Compilation & Daily Agenda UI

### Objective
Engine the deterministic client-side compilation algorithm that merges base schedules with user course toggles and renders a distraction-free "Today & Tomorrow" view.

### Steps
1. **Schedule Compiler Utility:**
   - Implement `src/lib/schedule/compiler.ts` using `date-fns-tz`.
   - Resolves target dates against workspace IANA timezone.
   - Calculates A/B week parity based on `workspaces.week_a_anchor_date`.
   - Filters out courses where `course_enrollments.is_muted === true`.
2. **Student Home View (Agenda):**
   - Screen: `src/app/(tabs)/index.tsx`.
   - Header: Current Date, Cohort Name, and Today/Tomorrow segmented control.
   - Class Cards:
     - Course Code + Color Stripe
     - Start/End Time formatted in workspace local time (with local device difference badge if student is in another timezone)
     - Room location
     - Live Status Badge (default: 🟢 Scheduled)
     - Dynamic relative countdown (*"Starts in 25 mins"*, *"Ongoing — 40 mins left"*)
3. **Course Toggle Drawer:**
   - Slide-over sheet listing all cohort courses with switches.
   - Toggling off updates `course_enrollments.is_muted` in Supabase and instantly recalculates the local daily agenda.

### Verification & Test Checkpoint
- [ ] Schedule renders correctly on device in different timezones (e.g. London vs. New York).
- [ ] Toggle off "Physics Lab"; disappears immediately from student's agenda.
- [ ] Bi-weekly A/B alternating classes show on their respective weeks only.

---

## Phase 5: Live Status Override Engine & Real-Time Sync

### Objective
Equip Class Admins with a rapid 2-tap status override bar that broadcasts cancellations, delays, and room changes to all students in <500ms via Supabase Realtime.

### Steps
1. **Admin Quick-Action Bar:**
   - Displayed conditionally at the top of the home screen *only* for users with `lead_admin` or `co_admin` roles.
   - Automatically detects current running class or next upcoming class within 12 hours.
2. **2-Tap Override Sheet:**
   - Component: `src/components/schedule/StatusOverrideSheet.tsx`.
   - Instant actions:
     - 🔵 **Started** (Marks class in session)
     - 🟡 **Delayed** (Quick pills: `+5m`, `+10m`, `+15m`, `+30m`)
     - 🔴 **Cancelled** (Prompts optional reason)
     - 📍 **Moved Room** (Text input for new room)
     - 🟣 **Instructor Away**
3. **Database Write to `schedule_overrides`:**
   - Inserts or updates row for `(base_schedule_id, current_date)`.
4. **Supabase Realtime Channel Subscription:**
   - In `src/hooks/useRealtimeSchedule.ts`:
     ```typescript
     supabase
       .channel(`workspace:${workspaceId}`)
       .on('postgres_changes', {
         event: '*',
         schema: 'public',
         table: 'schedule_overrides',
         filter: `course_id=in.(${userCourseIds.join(',')})`
       }, (payload) => {
         queryClient.invalidateQueries({ queryKey: ['daily-agenda'] });
       })
       .subscribe();
     ```

### Verification & Test Checkpoint
- [ ] Admin taps "Delayed +15m" on Class A.
- [ ] A second phone viewing the agenda reflects the delay in <500ms without manual refresh.
- [ ] Card turns yellow and displays updated start time: *"10:15 AM (Delayed 15m)"*.

---

## Phase 6: Push Notifications & Smart Quiet Hours

### Objective
Register device push tokens and deploy an automated Supabase Edge Function to dispatch push alerts for urgent status changes while respecting local quiet hours.

### Steps
1. **Expo Push Notification Client Integration:**
   - Install `expo-notifications`.
   - On app launch, request notification permissions.
   - Get `ExpoPushToken` and upsert into `user_push_tokens` with device platform and local timezone.
2. **Supabase Edge Function (`push-dispatcher`):**
   - Create `supabase/functions/push-dispatcher/index.ts`.
   - Triggered via Supabase Database Webhook on `schedule_overrides` INSERT/UPDATE.
   - Logic:
     - Identify affected `course_id`.
     - Query all active `user_push_tokens` for users enrolled where `is_muted = false`.
     - Check quiet hours: If current time in student's timezone is between 10:00 PM and 7:00 AM:
       - If status is `cancelled`, `delayed`, or `room_moved` for **today**: BYPASS quiet hours (urgent).
       - If status is general announcement or future task: QUEUE for 7:30 AM.
     - Send batched payload to `https://exp.host/--/api/v2/push/send`.

### Verification & Test Checkpoint
- [ ] Trigger an override on test device.
- [ ] Push notification arrives on real device within 3 seconds: *"🚨 Algorithms Cancelled: Prof on Leave"*.
- [ ] Muted students receive zero push notifications.

---

## Phase 7: Offline-First SQLite Storage & Background Sync

### Objective
Ensure instantaneous launch in lecture hall basements with zero connectivity, caching the complete timetable and overriding exceptions in local SQLite.

### Steps
1. **Install Expo SQLite:**
   ```bash
   npx expo install expo-sqlite
   ```
2. **Initialize Local SQLite DB:**
   - Create `src/lib/db/localDatabase.ts`.
   - Mirror schema for `cached_base_schedules`, `cached_overrides`, and `cached_tasks`.
3. **Offline Sync Repository Pattern:**
   - On app startup, read immediately from SQLite to render UI in <100ms.
   - Network listener via `@react-native-community/netinfo`:
     - When online: Fetch delta from Supabase (`updated_at > last_sync_timestamp`), write updates to SQLite, and update memory state.
4. **Optimistic Task Completion Queue:**
   - Students ticking off assignments offline store mutations in `offline_mutations` table and sync to Supabase when network reconnects.

### Verification & Test Checkpoint
- [ ] Enable Airplane Mode. Close and reopen app.
- [ ] Agenda loads completely and instantly without network errors.
- [ ] Re-enable network; app silently reconciles any new status overrides.

---

## Phase 8: High-Value Global Features

### Objective
Deliver the 5 global competitive differentiators defined in the PRD.

### Steps
1. **Feature 1: Bi-Weekly / A/B Cycle Configuration:**
   - Enable setting anchor date in Workspace settings.
   - Display "Week A" or "Week B" pill in agenda header.
2. **Feature 2: Presenter QR & Universal Deep-Links:**
   - Install `react-native-qrcode-svg` and `expo-screen-orientation`.
   - Admin "Present QR" screen boosts screen brightness to 100% and displays oversized QR code.
   - Universal links configured via `expo-linking` for `https://classsync.app/join/[code]`.
3. **Feature 3: Native Device Calendar 1-Way Sync:**
   - Install `expo-calendar`.
   - "Sync to Device Calendar" action creates isolated `"ClassSync - [Cohort]"` calendar.
   - Inserts recurring events matching enrolled courses.
4. **Feature 4: Crowd-Sourced Peer Verification:**
   - Student screen shows *"Report Class Status"* if 5 min past scheduled time and no admin override exists.
   - Submits to `peer_status_reports`. If count >= 3 within 10 min window, shows provisional status.
5. **Feature 5: Quick-Paste Syllabus Task Parser:**
   - Admin bulk deadline input modal.
   - Regex parser extracts dates, task types (Assignment, Exam, Quiz), and maps them into batch insert items.

### Verification & Test Checkpoint
- [ ] Universal link opens directly into cohort join preview.
- [ ] Native calendar on iOS/Android displays exported classes.
- [ ] 3 test peer reports trigger a provisional status badge.

---

## Phase 9: App Store & Google Play Store Hardening

### Objective
Fulfill Apple App Store and Google Play Store submission criteria for a flawless launch.

### Steps
1. **Apple Store Compliance Checklist:**
   - Native Apple Sign-In button properly positioned and styled.
   - Self-serve **"Delete Account"** option in settings (wiping Clerk profile and Supabase memberships).
   - Add iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) detailing zero tracking and device ID usage.
2. **Android Google Play Checklist:**
   - Target latest Android API Level (API 34/35).
   - Proper Notification Channel creation (`Urgent Class Alerts`, `Deadlines`).
   - Android back button hardware handlers.
3. **Production Build Setup via EAS (Expo Application Services):**
   - Configure `eas.json` with `production` and `preview` profiles.
   - Run EAS credentials setup for Apple Developer Team and Google Service Account Key.
   - Build commands:
     ```bash
     eas build --platform ios --profile production
     eas build --platform android --profile production
     ```

### Verification & Test Checkpoint
- [ ] TestFlight build uploaded and verified on physical iPhones.
- [ ] Android AAB uploaded to Google Play Internal Testing track and verified.
- [ ] Account deletion end-to-end test succeeds without orphan data.
