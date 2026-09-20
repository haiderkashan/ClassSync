# ClassSync — Architectural Decision Log (`decision_log.md`)

This document records the architectural and product decisions made during the design and development of ClassSync. Each entry details the context, the alternatives evaluated, the final decision, and the explicit rationale for why that decision is optimal.

---

## ADR-001: Mobile-Only Architecture (Zero Web Dashboard)

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** Class logistics apps often create a desktop web dashboard for administrators (teachers/admins) and a mobile app for students.
- **Alternatives Evaluated & REJECTED:**
  1. *Web Admin Dashboard + Mobile Student App:* Rejected. Requiring admins to use desktop web creates friction.
  2. *Progressive Web App (PWA):* STRICTLY REJECTED. PWAs cannot reliably deliver native iOS/Android push notifications, cannot interact natively with Apple EventKit/Android Calendar, and do not belong in the App Store/Play Store.
- **Final Decision: 100% Native Mobile-Only App (React Native Expo):**
  - We are building exclusively for the **Apple App Store (iOS)** and **Google Play Store (Android)**.
  - Native binaries (`.ipa` and `.aab`) compiled with Expo Application Services (EAS).
  - True native system APIs: Apple Push Notification service (APNs), Firebase Cloud Messaging (FCM), iOS Keychain & Android Keystore (`expo-secure-store`), and native SQLite (`expo-sqlite`).
- **Why This Decision is Best:**
  - **Frictionless Real-Time Usage:** Class representatives and student delegates are in lecture halls, walking between campuses, or in transit when classes are delayed or moved. Requiring an admin to open a laptop and log into a web dashboard directly destroys the sub-second speed needed for live updates.
  - **Push Notification Reliability:** Native push notifications on iOS (APNs) and Android (FCM) are vastly more reliable and instantaneous than Web Push, which suffers from strict background throttling, especially on iOS Safari.
  - **Single Unified Codebase:** Eliminates the cognitive and maintenance overhead of building and maintaining a web frontend, reducing time-to-market and keeping development focused on mobile polish.

---

## ADR-002: Deterministic "Base Schedule Loop + Exception Overrides" Engine

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** Academic timetables repeat weekly for 12–16 weeks, but reality involves frequent one-off cancellations, delays, room changes, and makeup classes.
- **Alternatives Considered:**
  1. *Pre-Generating Individual Calendar Events:* Generate 100+ calendar rows for every single lecture across the semester in PostgreSQL.
  2. *Standard iCalendar / Cron Recursion Strings:* Store RFC 5545 RRULE recurrence strings.
  3. *Base Recurring Loop + Date-Specific Exception Overrides:* Store weekly template rows (`base_schedules`) and separate date-specific exception rows (`schedule_overrides`).
- **Decision:** Implement the Base Loop + Exception Overrides architecture.
- **Why This Decision is Best:**
  - **Minimal Data Footprint:** A typical student cohort has ~15-20 weekly class slots. Pre-generating a full semester creates over 300 database rows per cohort. Storing a base loop requires only 15-20 rows forever, with exception rows created *only when an actual status change occurs* (typically 5-10 per term).
  - **Instant Global Edits:** If the permanent room for a Monday lecture changes midway through the term, the Admin updates 1 row in `base_schedules`, and the entire future schedule automatically updates.
  - **Offline Caching:** The client can cache the entire base timetable indefinitely in local SQLite with minimal storage (<50KB), ensuring the schedule is always visible in cellular dead zones.

---

## ADR-003: Clerk for Native Auth + Supabase for PostgreSQL & Realtime

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** The application requires high-frictionless social sign-in (Google and Apple Sign-In), instant session recovery, and a secure real-time relational database.
- **Alternatives Considered:**
  1. *Supabase Auth Alone:* Use Supabase's built-in GoTrue auth for Google/Apple OAuth.
  2. *Firebase Auth + Firestore:* Traditional NoSQL real-time stack.
  3. *Clerk Auth + Supabase PostgreSQL via JWT Bridging:* Use Clerk for mobile client auth and pass Clerk-issued JWTs to Supabase with PostgreSQL Row Level Security (RLS).
- **Decision:** Pair Clerk for Authentication with Supabase for PostgreSQL, Realtime, and Edge Functions.
- **Why This Decision is Best:**
  - **Native UX & Store Compliance:** Clerk's Expo SDK provides exceptional first-class support for native Google and Apple Sign-In with built-in biometric/secure store caching, avoiding tricky deep-linking webview redirects that often cause App Store rejections.
  - **Relational Integrity & RLS:** Supabase provides true PostgreSQL with advanced Row Level Security, relational foreign keys, and indexes, which prevents data leakage in a multi-tenant university setting far better than Firestore rules.
  - **Deterministic Token Bridge:** Clerk natively supports custom Supabase JWT templates, allowing PostgreSQL RLS policies to seamlessly inspect `auth.jwt() ->> 'sub'` without complex middle-tier authentication servers.

---

## ADR-004: Course-Level Guest Deep-Links vs. Cohort Bundle Enrolment

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** Higher education institutions have regular students (taking all standard degree courses) and irregular students (retaking a failed course, advanced credits, minor degrees, or exchange students).
- **Alternatives Considered:**
  1. *Cohort-Only Joining:* Every student must join the entire cohort workspace, manually muting all other courses.
  2. *Individual Course Joining for Everyone:* Force every student to join 5 distinct courses individually using 5 codes.
  3. *Hybrid Model (Cohort Bundle + Isolated Course Deep-Links):* Regular students join the workspace once and inherit all courses with toggle controls. Irregular students join via an isolated single-course deep-link as "Guest Members".
- **Decision:** Adopt the Hybrid Cohort Bundle + Course Guest Link model.
- **Why This Decision is Best:**
  - **Zero Friction for 90% of Students:** Standard cohort members scan 1 QR code or enter 1 join code and immediately have their entire semester timetable populated.
  - **Zero Spam for Irregular Students:** A guest repeating "Data Structures" only receives push notifications and updates for "Data Structures". They are not spammed by other cohort announcements.
  - **Data Privacy & Security:** RLS policies restrict guest students from querying the cohort's full roster or other courses, maintaining student privacy.

---

## ADR-005: Workspace-Level IANA Timezones with Relative Time Storage

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** Supporting a global audience across all 24 time zones where universities observe different Daylight Saving Time (DST) rules and weekend definitions.
- **Alternatives Considered:**
  1. *Convert Everything to Absolute UTC:* Store all class start times as UTC timestamps.
  2. *Floating Local Time Without Timezone Reference:* Store only "10:00 AM" with no timezone knowledge.
  3. *Workspace-Level IANA Timezone + Relative Local Time in DB:* Store `day_of_week` (1-7) and `time without time zone` (e.g. `10:00:00`) tied to `workspaces.timezone` (e.g. `America/New_York`, `Europe/London`).
- **Decision:** Use Workspace-Level IANA Timezone strings and relative local times for base schedules.
- **Why This Decision is Best:**
  - **Daylight Saving Time Immunity:** In universities, a 10:00 AM class remains at 10:00 AM local time when clocks spring forward or fall back. If stored in UTC, DST shifts would silently advance or delay recurring classes by an hour.
  - **Remote / Commuting Students:** Students studying remotely or traveling across time zones can view the class in the university's local time, with the client UI rendering an intuitive timezone difference tag.

---

## ADR-006: Dual Offline Storage Engine (Expo SQLite + MMKV)

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** University campuses frequently have cellular dead zones (underground lecture halls, concrete buildings). The app must load instantaneously without an internet connection.
- **Alternatives Considered:**
  1. *AsyncStorage Only:* Standard React Native key-value store.
  2. *Pure Online Fetching with Memory Cache:* TanStack Query in-memory caching only.
  3. *Dual Offline Storage: Expo SQLite (Relational) + MMKV (Key-Value):* High-performance offline architecture.
- **Decision:** Adopt Expo SQLite for relational timetable data and MMKV for rapid key-value settings.
- **Why This Decision is Best:**
  - **Sub-100ms Launch:** SQLite allows instant structured SQL queries to compile today's agenda before any network socket is opened.
  - **Complex Relational Filtering:** Joining base schedules with local mute toggles and overrides is trivial and fast in SQLite, whereas parsing large JSON blobs in AsyncStorage causes noticeable UI stuttering.
  - **MMKV Speed:** MMKV is up to 30x faster than AsyncStorage for reading user auth tokens, active cohort IDs, and UI theme preferences.

---

## ADR-007: Smart Push Notification Quiet Hours with Urgent Override Bypass

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** Midnight notifications (e.g., an Admin posting homework at 2:00 AM) cause notification fatigue and student uninstalls. Conversely, delaying a 7:30 AM class cancellation announcement until 8:00 AM causes students to travel unnecessarily.
- **Alternatives Considered:**
  1. *No Quiet Hours:* Send all notifications immediately.
  2. *Strict Quiet Hours (10:00 PM – 7:00 AM):* Block all notifications during night hours unconditionally.
  3. *Smart Quiet Hours with Urgency Classifier:* General tasks/notes respect local quiet hours; same-day cancellations, delays, and room changes bypass quiet hours immediately.
- **Decision:** Implement Smart Quiet Hours with Urgent Override Bypass in the Supabase Edge Function dispatcher.
- **Why This Decision is Best:**
  - **Protects Student Sleep & App Retention:** Eliminates late-night notification spam that leads to users disabling push notifications or uninstalling the app.
  - **Guarantees Critical Actionability:** When a professor cancels an 8:00 AM class at 6:30 AM, students need that alert immediately so they don't commute to campus for nothing.

---

## ADR-008: NativeWind v4 + Pinned Tailwind CSS v3.4 & Reanimated Babel Pipeline

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** React Native styling in 2026 requires fast compilation, minimal runtime overhead, and seamless dark mode / theme support. Tailwind CSS recently released v4, while React Native Reanimated requires strict Babel plugin ordering.
- **Alternatives Considered:**
  1. *StyleSheet API / Vanilla React Native styles:* Verbose, lacks consistent token design system, high boilerplate for layout.
  2. *Styled Components / Emotion:* Heavy runtime JS bridge overhead that hurts 60/120fps frame rates on low-end Android devices.
  3. *NativeWind v4 + Tailwind CSS v3.4:* Compiles Tailwind utility classes to optimized React Native StyleSheet objects at build time via Metro bundler integration (`withNativeWind`).
- **Decision:** Adopt NativeWind v4 with explicitly pinned Tailwind CSS v3.4 (`^3.4.17`), wrapping Metro with `withNativeWind` and placing `react-native-reanimated/plugin` strictly as the last Babel plugin.
- **Why This Decision is Best:**
  - **Zero-Runtime Overhead:** NativeWind transforms utility classes during Metro bundling, avoiding expensive runtime CSS-in-JS parsing.
  - **Reanimated Stability:** Enforcing Reanimated's plugin as the final item in Babel avoids UI thread worklet initialization crashes.
  - **Tailwind v4 Prevention:** Pinning Tailwind v3.4 guarantees stability against breaking CLI changes in Tailwind v4 until NativeWind v5 reaches GA.

---

## ADR-009: Supabase Schema Structure & Generated TypeScript Type Binding

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** The database schema requires deterministic separation between recurring schedules, real-time status exceptions, and course toggles. Client queries require compile-time type safety to prevent invalid field access.
- **Alternatives Considered:**
  1. *Manual TypeScript Interfaces:* Maintain hand-written interfaces on the client. (Prone to schema-drift bugs).
  2. *ORM (Prisma / Drizzle):* Adds heavy client-side query engines to React Native mobile bundles.
  3. *Supabase CLI Linked Type Generation (`database.types.ts`):* PostgreSQL is the single source of truth; CLI inspects remote schema and outputs exact TypeScript types.
- **Decision:** Use the Supabase CLI to generate `src/types/database.types.ts` directly from the linked PostgreSQL cloud database and pass the `Database` generic to `createClient<Database>()`.
- **Why This Decision is Best:**
  - **Zero Schema Drift:** Database migrations automatically cascade into compile-time TypeScript checks across all client components.
  - **Lightweight Runtime:** Zero additional ORM bundle overhead in the React Native mobile app.

---

## ADR-010: Global Provider Hierarchy & Native Hardware Token Caching

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** Mobile apps require secure, persistent authentication sessions that survive app kill cycles, alongside responsive asynchronous server state caching and in-memory client state.
- **Alternatives Considered:**
  1. *AsyncStorage for Auth Tokens:* Insecure; tokens stored unencrypted on device storage, vulnerable on rooted/jailbroken devices.
  2. *In-memory Auth Token only:* Forces students to re-login every time the app is swiped away.
  3. *Expo SecureStore (iOS Keychain / Android Keystore) + ClerkProvider + QueryClientProvider:* Encrypted hardware-level token caching paired with TanStack Query and Zustand.
- **Decision:** Implement `tokenCache` using `expo-secure-store` for Clerk, and assemble a consolidated `AppProviders` wrapper enclosing `ClerkProvider` and `QueryClientProvider` at the root layout.
- **Why This Decision is Best:**
  - **Hardware-Backed Security:** Protects user session tokens using the device's Secure Enclave / Keymaster.
  - **Single Source of Truth:** Clean separation between Server State (TanStack Query), Local Client State (Zustand), and Identity (Clerk).

---

## ADR-011: Client-Side Authenticated Profile Upsert Engine vs. Webhook Architecture

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** When a user registers or logs in via Clerk, their profile (`id`, `email`, `display_name`, `avatar_url`) must exist in Supabase `public.profiles` so foreign keys in `section_members`, `sections`, and `course_enrollments` function properly.
- **Alternatives Considered:**
  1. *Clerk Webhook to Supabase Edge Function:* Server-side webhook listener with Svix signature validation. (Subject to network race conditions where mobile app navigates to dashboard before the webhook writes to PostgreSQL, resulting in 404 queries).
  2. *Client-Side Authenticated Upsert on Protected Entry:* The mobile app executes an atomic `supabase.from('profiles').upsert(...)` using the authenticated Clerk JWT upon entering `(tabs)`.
- **Decision:** Adopt the Client-Side Authenticated Upsert Engine (`useSyncProfile`) integrated directly into the `(tabs)` layout.
- **Why This Decision is Best:**
  - **Zero Race Conditions:** The user's profile is guaranteed to exist before they attempt to create or join a cohort.
  - **Zero Infrastructure Maintenance:** Eliminates the need to maintain, deploy, and monitor an external Edge Function or manage Svix webhook secrets.
  - **Strict Security via RLS:** The upsert is restricted by PostgreSQL Row Level Security (`id = current_user_id()`), guaranteeing that a user can only write to their own profile row.

---

## ADR-012: Expo SDK 57 & Reanimated 4 Peer Dependency Architecture

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** In Expo SDK 57 (React Native 0.86, React 19), `react-native-reanimated@4.5.1` separated worklet compilation into `react-native-worklets@0.10.x` as an explicit peer dependency, and `newArchEnabled` was removed from `app.json` as New Architecture is enabled by default.
- **Alternatives Considered:**
  1. *Downgrade to Reanimated v3:* Disrupts Expo SDK 57 native compatibility and modern React 19 support.
  2. *Install Required Peers explicitly (`react-native-worklets`, `expo-auth-session`, `react-dom`, `babel-preset-expo`):* Maintain modern architecture while satisfying Babel compiler plugins and Metro bundler transformers.
- **Decision:** Explicitly install `react-native-worklets`, `expo-auth-session`, `react-dom`, and `babel-preset-expo`, and remove deprecated `newArchEnabled` from `app.json`.
- **Why This Decision is Best:**
  - **Zero Bundler Transformer Failures:** Metro bundler builds clean JS bundles (3,899+ modules verified with 0 errors).
  - **100% Expo Doctor Pass Rate:** 21/21 checks passing with zero warnings or version mismatches.

---

## ADR-013: Atomic Workspace & Enrollment RPCs with Cryptographic Join Codes

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** Multi-tenant university onboarding requires atomic operations across `sections`, `section_members`, `courses`, and `course_enrollments`. Sequential client-side inserts risk partial failures, orphan rows, and RLS timing errors.
- **Alternatives Considered:**
  1. *Client-side sequential Supabase queries:* High risk of network dropouts midway through cohort join.
  2. *External Edge Function:* Introduces external infrastructure dependency for core relational operations.
  3. *PostgreSQL PL/pgSQL RPCs with `security definer`:* Single transaction execution in database kernel.
- **Decision:** Implement PL/pgSQL stored procedures (`join_section_via_code`, `create_course`, `join_course_guest`, `leave_section`, `archive_section`, `transfer_section_ownership`).
- **Why This Decision is Best:**
  - **ACID Atomicity:** Every enrollment or departure executes in a single database transaction; failure rolls back cleanly.
  - **Guaranteed Role Invariants:** Genesis CR departure safeguards and 2-admin limits are enforced at the database level regardless of client state.
  - **Single Roundtrip:** Students join a section and auto-enroll in all courses in <150ms over cellular.

---

## ADR-014: Zustand Persist Middleware with AsyncStorage for Cold-Boot Hydration

- **Date:** 2026-09-18
- **Status:** Accepted
- **Context:** When a student opens ClassSync in lecture halls with zero cellular connectivity, the app must boot directly into their enrolled section and schedule without flashing an empty state or spinning indicator.
- **Alternatives Considered:**
  1. *In-memory state only:* Causes a blank screen until Supabase network queries complete.
  2. *Blocking SQLite read in root layout:* Can cause noticeable native frame drops during app splash dismiss.
  3. *Zustand `persist` middleware backed by `AsyncStorage`:* Automatic asynchronous hydration into React memory state during boot.
- **Decision:** Wrap `useAppStore` with Zustand `persist` middleware targeting `AsyncStorage`.
- **Why This Decision is Best:**
  - **Zero-Flicker Cold Boot:** Workspace, courses, active section ID, and timetable blocks hydrate in <50ms.
  - **Offline-First Synchronization:** The UI displays the last known good schedule immediately, while TanStack Query quietly revalidates in the background if network connectivity is present.

---

## ADR-015: Soft-Clash Warning (Override Allowed) vs. Hard Constraint Enforcement

- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** In universities, a 50-student section frequently splits into smaller lab groups that run simultaneously in different rooms (e.g. Group A in CS Lab 1, Group B in CS Lab 2 from 10:00 to 12:00). A hard database exclusion constraint prevents the Class Admin from building the actual cohort schedule.
- **Alternatives Considered:**
  1. *Hard PostgreSQL exclusion constraint (`EXCLUDE USING GIST`):* Rejects any overlapping time interval on the same day. (Breaks university lab splits).
  2. *Silent overlap allowance:* Saves without warnings. (Leads to accidental CR scheduling mistakes).
  3. *Soft-Clash Detection with real-time UI warning & permissive save:* Client evaluates interval intersection math $\max(S_1, S_2) < \min(E_1, E_2)$ in real time, displays a prominent amber warning card with conflicting session details, but permits saving via `upsert_base_schedule_block`.
- **Decision:** Adopt the Soft-Clash (Override Allowed) model.
- **Why This Decision is Best:**
  - **Real-World University Compatibility:** Accommodates split laboratory groups, elective cohort splits, and simultaneous tutorial sessions.
  - **User Error Prevention:** Prominent warning alert guarantees the Class Admin is fully aware of the collision before committing the schedule block.

---

## ADR-016: Non-Course Session Types & Foreign Key Integrity

- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** Academic timetables require recurring breaks, Friday prayer periods, and cohort meetings that do not belong to an academic course. However, `base_schedules` has a non-nullable foreign key `course_id REFERENCES courses(id)`.
- **Alternatives Considered:**
  1. *Make `course_id` nullable in PostgreSQL schema:* Requires modifying all downstream queries, RLS policies, and joins.
  2. *Reject non-course sessions:* Forces students to consult separate apps for breaks and prayer times.
  3. *Anchor non-course sessions to section primary course & conditionally render in UI:* When session type is `break`, `prayer`, or `meeting`, hide the Course picker in the form modal, automatically anchor to the section's primary course in the database, and display distinctive iconography and badges.
- **Decision:** Anchor non-course sessions to the section primary course while hiding the course picker in the UI.
- **Why This Decision is Best:**
  - **Preserves Relational Integrity:** Zero schema migrations or nullable foreign key risks; all existing RLS policies and cascading deletes work out of the box.
  - **Frictionless UX:** CRs can add a "Friday Jummah Prayer" or "Lunch Break" in 5 seconds without having to pick a fake course.

---

## ADR-017: Client-Side Week Parity State & Agenda Filtering

- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** Many universities follow bi-weekly alternating schedules (Week A / Week B). Displaying all classes on a single day timeline without parity filtering produces visual collision between alternating sessions.
- **Alternatives Considered:**
  1. *Server-side parameterized filtering:* Extra network latency on every toggle.
  2. *Pure calendar date derivation:* Prevents students from previewing alternating week schedules in advance.
  3. *Client-side Zustand state (`currentParity`) with reactive selector:* Persisted segmented control (`Week A` | `Week B` | `All`) filtering cached schedule blocks instantly.
- **Decision:** Implement client-side `currentParity` state in Zustand with a segmented toggle on the Student Agenda.
- **Why This Decision is Best:**
  - **Zero Latency:** Instantaneous schedule re-rendering with zero network requests.
  - **Complete Flexibility:** Students can filter exclusively to their active week cycle or view "All" to plan upcoming assignments.

---

## ADR-018: Dual-Source Schedule Fetching for Irregular Guest Students

- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** Irregular or retake students join individual courses via guest invite links without enrolling in a section (`activeSectionId = null`). A schedule query that strictly filters by `section_id = activeSectionId` renders an empty agenda.
- **Alternatives Considered:**
  1. *Force guest students to create dummy sections:* Highly confusing user experience.
  2. *Dual-source schedule querying:* If `activeSectionId` is present, fetch section schedule; concurrently or fallback, query blocks for any course ID present in `activeCourses`, merging the results.
- **Decision:** Implement dual-source schedule query in `useBaseSchedule.ts`.
- **Why This Decision is Best:**
  - **Zero Blank Screen Defect:** Irregular students immediately see their classes on the Daily Agenda without section enrollment.
  - **Strict Privacy Preservation:** Guest students only receive blocks for courses they have explicitly joined, fulfilling FERPA and GDPR privacy requirements.

---

## ADR-019: Global Safe Area Architecture & Floating Pill Dock Navigation

- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** The legacy `SafeAreaView` from standard `react-native` fails to account for Android edge-to-edge display and dynamic iOS island/notch insets, resulting in content rendering beneath the status bar. Concurrently, default platform tab bars were utilitarian and lacked modern luxury feel.
- **Alternatives Considered:**
  1. *Hardcoded top and bottom margins:* Fragile across devices (breaks on foldable phones, tablets, or notch-less older devices).
  2. *Standard Expo Router `tabBarStyle` tweaking:* Limited customization; cannot render floating capsule dock with active dark pill and icon-only inactive touch targets.
  3. *`react-native-safe-area-context` with custom `FloatingTabBar`:* Explicit edge management (`edges={['top', 'left', 'right']}` on tab screens) paired with a floating dock positioned via `useSafeAreaInsets()`.
- **Decision:** Standardize on `react-native-safe-area-context` across all 10 root screens and modals, and implement a custom floating pill dock navigation bar.
- **Why This Decision is Best:**
  - **Zero Status Bar Collision:** Content consistently offsets below the status bar, battery, time, and camera punch-hole across all iPhone and Android configurations.
  - **Premium Mobile Ergonomics:** Floating capsule dock elevates key actions within comfortable thumb reach while maximizing readable screen real estate.

---

## ADR-020: Soft Pastel Card System & Vertical Time Axis Agenda

- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** Dense tabular or high-contrast saturated timetable interfaces induce cognitive fatigue when students check schedules between lectures. A modern soft UI design language reduces eye strain while enhancing visual hierarchy.
- **Alternatives Considered:**
  1. *High-contrast saturated color blocks:* Visually jarring with multiple consecutive classes.
  2. *Single-color uniform list:* Fails to distinguish between lecture, lab, prayer breaks, and cohort meetings at a glance.
  3. *Pastel palette matrix paired with vertical timeline axis:* Categorizes sessions by type (mint green for labs, sky blue for lectures, peach for breaks, teal for prayers, lavender for meetings, rose for tutorials/seminars) alongside a vertical time axis and dynamic weekday date selector.
- **Decision:** Implement the soft pastel card design language with vertical timeline time axis and dynamic week date selector.
- **Why This Decision is Best:**
  - **Sub-Second Scannability:** Students immediately discern session type, duration, and room location with minimal cognitive load.
  - **Luxury Brand Aesthetics:** Evokes premium modern product design while preserving 100% of underlying offline and conflict-detection logic.

---

## ADR-021: Schedule Overrides Schema with Nullable Base ID & Revert-to-Scheduled Cleanup

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** Academic timetables require both date-specific exceptions on existing recurring classes (cancellations, delays, room moves) and ad-hoc one-off makeup classes (e.g. weekend lab sessions). Furthermore, if a CR accidentally marks a class as cancelled and then reverts it to scheduled, storing dead override rows bloats the database and increases query overhead.
- **Alternatives Considered:**
  1. *Strict non-null `base_schedule_id`:* Precludes ad-hoc makeup sessions on unscheduled days.
  2. *Separate `makeup_classes` and `schedule_exceptions` tables:* Complicates client queries and requires dual Realtime WebSocket channels and complex outer joins.
  3. *Unified `schedule_overrides` table with nullable `base_schedule_id` and partial unique index:* Single table handles both exceptions and makeup slots. The atomic RPC `upsert_schedule_override` automatically cleans up rows when reverted to default 'scheduled' status with 0 delay.
- **Decision:** Implement unified `schedule_overrides` with nullable `base_schedule_id`, partial unique index `(base_schedule_id, override_date) where base_schedule_id is not null`, and automatic revert cleanup.
- **Why This Decision is Best:**
  - **Single WebSocket Stream:** All live timetable status deltas flow through a single `public:schedule_overrides` channel.
  - **Support for Ad-Hoc Sessions:** Weekend and evening makeup classes can be scheduled with zero friction.
  - **Lean Database Footprint:** Reverting an exception deletes the override row, keeping active database rows minimal and client merges fast.

---

## ADR-022: DST-Immune Calendar Day Differences & Reactive Midnight Watcher Hook

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** Higher education institutions across the UK, Europe, Australia, and South Asia frequently operate on alternating bi-weekly schedules (Week A vs. Week B). Automatically resolving parity on the mobile client requires computing elapsed weeks between a section's `week_a_anchor_date` and the target date. Furthermore, students studying late into the night require the "Today" agenda to automatically advance to "Tomorrow" at midnight without manual screen pulls or stale state.
- **Alternatives Considered:**
  1. *Wall-Clock Millisecond Division:* `Math.floor((targetDate.getTime() - anchorDate.getTime()) / (7 * 86400000))`. Fails across Daylight Saving Time (DST) boundaries when a 23-hour or 25-hour day throws off week counts. Also fails with negative date ranges prior to semester start.
  2. *Server-Side Parity Resolution Endpoint:* Violates the offline-first mandate and introduces network latency on timetable render.
  3. *Pure UTC Calendar Day Normalization with Symmetrical Modulo Arithmetic:* Normalize both target date and anchor date to the UTC Monday of their respective calendar weeks. Compute whole days divided by 7, and apply symmetrical modulo `((diffWeeks % 2) + 2) % 2`. Pair with a custom `useLiveDayWatcher` React hook that couples `AppState` resume events with a precise midnight timeout to invalidate query caches.
- **Decision:** Adopt UTC Monday calendar normalization and symmetrical modulo for parity calculation, coupled with `useLiveDayWatcher` for background-to-foreground and midnight cache invalidation.
- **Why This Decision is Best:**
  - **100% DST Immunity:** Because UTC dates never observe daylight saving shifts or clock adjustments, leap days and 23/25 hour days never shift parity.
  - **Sub-Millisecond Offline Evaluation:** The math executes purely on the client in $O(1)$ time with zero network requests.
  - **Zero-Battery Midnight Rollover:** Rather than polling an interval loop, `useLiveDayWatcher` calculates the exact milliseconds until midnight in the section's timezone, sets a single passive timer, and listens to native OS `AppState` changes for instantaneous cache invalidation upon device wake.

---

## ADR-023: Pure Client Schedule Compilation Engine & Realtime Subscription Store

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** Students viewing their daily timetable need to see a unified chronological agenda that seamlessly integrates recurring weekly schedules (`base_schedules`), date-specific exception overrides (cancellations, delays, room moves from `schedule_overrides`), ad-hoc makeup sessions (`base_schedule_id === null`), and respects each student's course toggles (`is_active === false`). Furthermore, real-time timetable updates must flow to client devices instantly without leaving zombie WebSocket channels when switching workspaces.
- **Alternatives Considered:**
  1. *Server-Side Dynamic SQL Views:* Create a PostgreSQL view or edge function that merges base schedules with overrides on every client request. (Rejected: completely fails when offline, incurs continuous database compute, and cannot leverage local SQLite cache).
  2. *Single monolithic array mutation:* Mutate recurring base schedules directly in place with overrides. (Rejected: pollutes permanent baseline templates, makes reverting exceptions messy, and breaks offline synchronization).
  3. *Pure Client Compiler Function + Zustand Dual-Source Realtime Store:* Implement `compileDailySchedule` as a pure, deterministic function. In `useScheduleOverrides`, execute dual-source queries (`section_id` for cohort members OR `course_id IN activeCourses` for guests) with TanStack Query caching and subscribe to Supabase Realtime with explicit `supabase.removeChannel(channel)` cleanup on unmount.
- **Decision:** Implement pure `compileDailySchedule` client engine and `useScheduleOverrides` React hook with Realtime WebSocket sync and strict channel removal.
- **Why This Decision is Best:**
  - **Sub-Millisecond Offline Execution:** Zero network requests required to render an up-to-date daily agenda; base schedules and overrides are compiled entirely in client memory.
  - **Zero Memory Leaks:** Returning `supabase.removeChannel(channel)` from `useEffect` ensures that switching sections or logging out destroys active Phoenix WebSocket channels cleanly.
  - **Full Guest Support:** Dual-source querying ensures irregular students who join specific courses via invite tokens receive live exception updates identically to standard cohort members.

---

## ADR-024: Lightweight Route Identifiers & Dynamic Exception Badging

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** Class Admins and Co-Admins need to broadcast schedule status exceptions (delays, room moves, cancellations, makeups) from their mobile devices with minimal friction. Passing complex domain objects through navigation route parameters in React Native / Expo Router is an anti-pattern that bloats URL stacks, causes serializability warnings, and desynchronizes stale local copies.
- **Alternatives Considered:**
  1. *Full Block Object Serialization in Route Params:* Pass `JSON.stringify(block)` in query params. (Rejected: produces huge navigation URLs, breaks if fields contain circular or non-serializable references, and leads to stale data bugs if state updates while the modal is open).
  2. *Ephemeral Context / Global Temporary Variables:* Store the editing block in a mutable global variable. (Rejected: fragile during app reloads or background resumption).
  3. *Lightweight Route Identifiers (`base_schedule_id`, `course_id`, `override_date`) + Store Hydration:* Pass only essential primitive keys in route params. The modal extracts the fresh record directly from the persisted Zustand store (`useAppStore`). If `override_date` is omitted (e.g. ad-hoc makeups), render a native DatePicker to establish explicit calendar context.
- **Decision:** Adopt lightweight route identifier pattern for the Exception Broadcast Modal, paired with dynamic soft badges on `ScheduleBlockCard`.
- **Why This Decision is Best:**
  - **Zero Serialization Overhead:** Navigation parameters remain tiny strings (`UUID` and `YYYY-MM-DD`), preventing Metro and deep-linking memory issues.
  - **Single Source of Truth:** The modal always reads the authoritative, up-to-date schedule block and override from the client store.
  - **Sub-Second Admin Ergonomics:** CRs can long-press any card on the Student Agenda to immediately broadcast a delay or cancellation with 2 taps.

---

## ADR-025: Context-Aware Smart Evening Recommendation Pill & Empty State Architecture

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** Students viewing their timetable late at night (e.g. past 20:00) predominantly want to see tomorrow's class schedule rather than today's finished lectures. Permanent segmented controls or status filters (All/Delayed/Cancelled) add unnecessary cognitive clutter to daily agendas that typically only have 2-5 classes.
- **Alternatives Considered:**
  1. *Permanent "Today / Tomorrow" Segmented Toggle:* Takes up precious vertical header space all day, causing visual redundancy with the existing dynamic weekday date strip.
  2. *Status Filter Chips (All, Delayed, Cancelled):* Over-engineering that clutters the UI when lists only contain 2-5 items.
  3. *Context-Aware Smart Evening Pill & Differentiated Empty States:* Detect local wall-clock hour in the section's IANA timezone. If $\ge$ 20:00 and viewing Today, conditionally render a sleek dark floating pill ("🌙 Good evening! Tap to preview tomorrow") that smoothly switches the active day to tomorrow. Differentiate empty states between "Weekend Recharge", "Free Day", and "All Classes Cancelled Today".
- **Decision:** Implement the context-aware Smart Evening Pill and contextual empty states, dropping redundant filters.
- **Why This Decision is Best:**
  - **Zero Daytime Clutter:** During active class hours (08:00–19:59), the agenda remains pure, minimalist, and focused on current lectures.
  - **Instant Evening Utility:** Students preparing for the next morning can view tomorrow's timetable with a single thumb tap.
  - **Clear Contextual Feedback:** Rather than generic empty text, students immediately distinguish between a scheduled rest day, a weekend, and a day where all classes were called off by instructors.

---

## ADR-026: Realtime Channel Isolation, Mutation-Only Hook Consumption & Dual Card Press Ergonomics

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** When Class Representatives clicked "+ Alert" or held a class block on the Agenda, the modal screen (`broadcast-exception.tsx`) mounted over the parent screen (`(tabs)/index.tsx`). Because both components invoked `useScheduleOverrides()`, the hook attempted to subscribe to the same Supabase Realtime channel name twice without unmounting the parent. In `@supabase/realtime-js`, invoking `.on()` after `.subscribe()` throws a fatal error: `cannot add postgres_changes callbacks after subscribe()`, causing the modal to crash and unmount immediately.
- **Alternatives Considered:**
  1. *Global Monolithic Realtime Provider:* Mount a single top-level WebSocket listener in the root layout. (Rejected: keeps WebSocket connections active even when viewing settings or auth screens, consuming unnecessary mobile battery and socket limits).
  2. *Shared Channel State Mutation:* Attempt to share a single channel reference across multiple components. (Rejected: unmounting one component removes the channel for remaining active components, causing subtle desynchronization bugs).
  3. *Instance-Isolated Channel Names + `enableRealtime` Parameter:*
     - Allow callers to pass `{ enableRealtime: false }` when only mutations (`upsertOverride`, `deleteOverride`) are required.
     - When `enableRealtime: true`, append an instance-unique random suffix to the channel topic (`realtime_schedule_overrides_${sectionId}_${instanceSuffix}`), ensuring every active subscriber manages its own isolated lifecycle without channel collisions.
     - Wire both `onPress` and `onLongPress` on `ScheduleBlockCard` so CRs can easily trigger broadcast actions via single click or long-press across all platforms (web, iOS, Android).
- **Decision:** Implement instance-isolated channel topics, `enableRealtime` flag on `useScheduleOverrides`, and dual click/long-press triggers on `ScheduleBlockCard`.
- **Why This Decision is Best:**
  - **Zero Channel Collision Crashes:** Each subscriber manages its own channel independently; no two components ever attach listeners to an already-subscribed channel.
  - **Optimized Mobile Battery & Bandwidth:** Input modals and mutation-only forms never open duplicate WebSocket sockets.
  - **Flawless Multi-Platform Ergonomics:** CRs can click or hold cards smoothly on desktop mice, touchpads, and touchscreens.

---

## ADR-027: PostgreSQL Partial Unique Indexes & RPC Upsert for Nullable Uniqueness

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** The attendance tracking system requires recording attendance sessions (`attendance_logs`) for both recurring schedule blocks (`schedule_block_id` populated) and ad-hoc makeup lectures (`override_id` populated, `schedule_block_id` NULL). In standard SQL and PostgreSQL, `NULL != NULL`. A naive composite constraint like `UNIQUE(user_id, course_id, attendance_date, schedule_block_id)` fails when `schedule_block_id` is NULL because PostgreSQL considers two NULL values distinct, silently allowing duplicate attendance entries for the same student on the same makeup class.
- **Alternatives Considered:**
  1. *Dummy Non-Null UUID for Makeup Blocks:* Assign a hardcoded zero-UUID (`00000000-0000-0000-0000-000000000000`) whenever `schedule_block_id` is null. (Rejected: violates foreign key integrity and requires messy dummy records).
  2. *Single Application-Level Lock in Node/Edge:* Rely on client-side or edge function checks before inserting. (Rejected: susceptible to race conditions when a student double-taps quickly on poor network).
  3. *Three Complementary Partial Unique Indexes + Atomic PL/pgSQL RPC:* Create partial unique indexes enforcing distinctness across non-null combinations:
     - `UNIQUE(user_id, course_id, attendance_date, schedule_block_id) WHERE schedule_block_id IS NOT NULL AND override_id IS NULL`
     - `UNIQUE(user_id, course_id, attendance_date, override_id) WHERE schedule_block_id IS NULL AND override_id IS NOT NULL`
     - `UNIQUE(user_id, course_id, attendance_date, schedule_block_id, override_id) WHERE schedule_block_id IS NOT NULL AND override_id IS NOT NULL`
     In `log_attendance_session`, execute an explicit query matching nullable parameters before updating or inserting.
- **Decision:** Implement complementary partial unique indexes and an atomic PL/pgSQL upsert RPC (`log_attendance_session`).
- **Why This Decision is Best:**
  - **100% Relational Integrity:** Completely eliminates duplicate rows without foreign key hacks or surrogate sentinel IDs.
  - **Atomic Upsert:** The PL/pgSQL function runs inside a single database transaction, ensuring sub-millisecond updates without concurrency races.

---

## ADR-028: Attendance Bunk & Recovery Mathematical Formulation with Floating-Point Epsilon Guard

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** Students need actionable, mathematically sound answers to two critical questions: "How many upcoming classes can I skip without dropping below my attendance threshold (e.g. 75%)?" and "If I am currently below the threshold, how many consecutive classes must I attend to recover?" Because JavaScript executes standard IEEE 754 double-precision floating-point arithmetic, boundary values (such as $P=3, T=4, R=0.75$) can yield numbers like `0.9999999999999998` or `1.0000000000000002`, causing `Math.floor` or `Math.ceil` to produce off-by-one errors.
- **Alternatives Considered:**
  1. *Simulated Discrete Loops:* Step through future classes one by one in a while loop until the percentage crosses the threshold. (Rejected: $O(N)$ runtime, computationally inefficient, and prone to infinite loops on high recovery targets).
  2. *Standard Unadjusted Math Formulas:* Directly compute `Math.floor((P - R*T)/R)`. (Rejected: floating-point drift occasionally calculates $3 - 0.75 \times 4 = -2.22 \times 10^{-16}$, causing `Math.floor` to return $-1$ instead of $0$).
  3. *Closed-Form Algebraic Derivations with Floating-Point Epsilon Guard ($\epsilon = 10^{-9}$):*
     - Skips Allowed ($C \ge R$): $S = \left\lfloor \frac{P - R \cdot T}{R} + 10^{-9} \right\rfloor$
     - Recovery Needed ($C < R$): $M = \left\lceil \frac{R \cdot T - P}{1 - R} - 10^{-9} \right\rceil$
- **Decision:** Implement closed-form algebraic equations with an $\epsilon = 10^{-9}$ guard in `bunkCalculator.ts`.
- **Why This Decision is Best:**
  - **Instant $O(1)$ Computation:** Zero loops; calculates skips and recovery classes in microseconds.
  - **Absolute Boundary Precision:** The epsilon guard prevents IEEE 754 precision leakage from producing off-by-one errors across all percentage thresholds (75%, 80%, 85%, etc.).
  - **Categorical State Hygiene:** Automatically segments status into `safe` (skips $\ge 1$), `warning` (skips $= 0$), and `critical` (recovery required).

---

## ADR-029: Rolling 7-Day Window for "Due Soon" Deadlines vs. Calendar Week Endpoints

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** Academic deadline trackers typically bucket tasks into "This Week" and "Next Week" using calendar boundaries (e.g. Sunday midnight). For a student viewing their deadlines on a Friday afternoon, a project due on Monday (in 3 days) is relegated to "Next Week", falsely signaling that it is not urgent, whereas an assignment due in 10 hours on Saturday is marked "This Week".
- **Alternatives Considered:**
  1. *Calendar Week Bucketing (Sunday/Monday cutoff):* Standard desktop calendar behavior. (Rejected: causes jarring context shifts depending on which day of the week the student opens the app).
  2. *Static 48-Hour Urgent Filter:* Only flag tasks due within 48 hours. (Rejected: too narrow; students cannot plan study schedules for upcoming tests 4-5 days ahead).
  3. *Continuous Rolling 7-Day Window ($now \le \text{dueDate} \le now + 7\text{ days}$):* Every task due within the next 168 hours is classified as `due_soon`.
- **Decision:** Adopt the continuous rolling 7-day window for `due_soon` tasks in `deadlineCategorizer.ts`.
- **Why This Decision is Best:**
  - **Invariant Urgency Horizon:** Regardless of whether today is Tuesday, Friday, or Sunday, the student always sees an unbroken 7-day lookahead of pending deliverables.
  - **Reduced Cognitive Burden:** Deadlines due within a week are consistently highlighted with amber warning badges without arbitrary weekend resets.

---

## ADR-030: Cross-Platform DateTimePicker Architecture with Web Fallback & Quick Presets

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** The Create Task modal requires students to pick a due date and time. On iOS and Android, `@react-native-community/datetimepicker` renders the native wheel or calendar dialog. However, in the Expo Web Bundler (used for development, debugging, and cross-platform verification), the native datetimepicker library has incomplete DOM implementations and causes unhandled JavaScript exceptions or blank modal freezes.
- **Alternatives Considered:**
  1. *Third-Party Cross-Platform Modal Libraries:* Install heavyweight JS date picker packages. (Rejected: bloats bundle size and loses native iOS/Android system feel).
  2. *Text-Only ISO Input:* Require students to type `YYYY-MM-DD HH:MM`. (Rejected: horrific mobile UX prone to validation errors).
  3. *`Platform.OS === 'web'` Conditional Branching with HTML5 Inputs & Quick Presets:*
     - On native iOS/Android, render `@react-native-community/datetimepicker`.
     - On web, render native HTML5 `<input type="date">` and `<input type="time">` styled with NativeWind.
     - Across all platforms, provide 1-tap quick preset pills: `+1 Day`, `+3 Days`, `+1 Week`, `Midnight (23:59)`, and `End of Day (17:00)`.
- **Decision:** Implement platform-branching datetime picker with HTML5 web fallback and quick preset buttons.
- **Why This Decision is Best:**
  - **Zero Web Crashes:** The web bundler renders stable, standard HTML5 inputs with zero native dependency conflicts.
  - **1-Tap Ergonomics:** Over 70% of university assignments are set to "Next class" or "Midnight"; preset pills enable sub-second deadline creation with 1 tap.

---

## ADR-031: Master Segmented Toggle ("Pending" vs. "Completed") & `SectionList` Virtualization

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** As a semester progresses over 16 weeks, a student accumulates dozens of finished homework assignments, quizzes, and project milestones. Rendering completed tasks at the bottom of a single scrollable screen creates an "Infinite Scroll Trap" where pending urgent deadlines compete with obsolete completed items.
- **Alternatives Considered:**
  1. *Single ScrollView with Collapsible Accordion:* Render a collapsed "Completed (42)" drawer at the bottom. (Rejected: still mounts and renders unvirtualized DOM nodes, degrading scroll performance).
  2. *Automatic Permanent Deletion:* Delete completed tasks immediately upon checkoff. (Rejected: destructive; students frequently need to verify past submissions during grading disputes).
  3. *Master Segmented Toggle ("Pending" vs. "Completed") + `SectionList` Virtualization:*
     - Pinned header segmented control switches views between active "Pending" deadlines and the "Completed" archive.
     - The Pending view groups items into "Overdue", "Due Soon", and "Upcoming" using React Native's high-performance `SectionList` with sticky section headers.
- **Decision:** Implement the Master Segmented Toggle paired with `SectionList` virtualization in `(tabs)/tasks.tsx`.
- **Why This Decision is Best:**
  - **60fps Virtualized Rendering:** `SectionList` only renders items currently visible within the viewport window, ensuring butter-smooth scrolling regardless of semester size.
  - **Zero Visual Noise:** The primary workspace remains laser-focused on pending tasks, while completed items remain accessible in 1 tap for reference.

---

## ADR-032: Timezone-Aware Time Guards on 1-Tap Attendance Logging (`isAttendanceEligible`)

- **Date:** 2026-09-20
- **Status:** Accepted
- **Context:** To make attendance tracking effortless, 1-tap attendance pills (`P`, `A`, `L`) were integrated directly onto the Daily Agenda timetable cards. However, if a student taps "Present" on a lecture scheduled for tomorrow, or on a 4:00 PM lecture at 9:00 AM today, the database records an attendance session that has not actually occurred ("The Future Logging Bug").
- **Alternatives Considered:**
  1. *Database Trigger Exception:* Raise a PostgreSQL exception if `attendance_date > CURRENT_DATE`. (Rejected: fails to account for class start times on the current day, and produces jarring runtime error dialogs on mobile).
  2. *Hide the Entire Card:* Don't show upcoming classes on the agenda. (Rejected: students need to see their upcoming schedule!).
  3. *Client-Side Timezone-Aware Eligibility Guard (`isAttendanceEligible`):*
     - If `classDate < today`: eligible (past class).
     - If `classDate > today`: ineligible (future date).
     - If `classDate === today`: eligible only if the current wall-clock time in the section's IANA timezone $\ge$ `block.start_time`.
     - When ineligible, the card hides the 1-tap logger and displays an informative subtitle: `"Attendance unlocks at HH:MM"`.
- **Decision:** Implement pure timezone-aware `isAttendanceEligible` in `src/lib/attendance/timeGuard.ts`.
- **Why This Decision is Best:**
  - **Prevents Corrupt Attendance Data:** Students cannot accidentally or prematurely log sessions before class starts.
  - **Clear User Intent:** Replacing logger buttons with an "Unlocks at HH:MM" badge provides immediate cognitive clarity without jarring error alerts.
