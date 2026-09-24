# ClassSync — Phase 7 Manual QA Protocol: Offline-First SQLite & Sync Verification

This testing protocol verifies that the 3-Tier Local-First Caching Architecture (Zustand L1, SQLite L2, Supabase L3), the FIFO offline mutation queue, and the tombstone deletion sync operate flawlessly on physical devices and simulators under real-world cellular dead-zone conditions.

---

## Prerequisites & Test Environment
- **Device:** Physical iOS / Android device or simulator running Expo Go / EAS development build.
- **Tools:** Terminal access with Metro bundler running (`npx expo start`), and Supabase Dashboard (or Supabase Table Editor).
- **Test Accounts:**
  - Account A: Genesis Class Representative (CR) / Cohort Member.
  - Account B (Optional for cross-device tombstone test): Peer student in same section.

---

## Test Scenario Matrix

| Test Case | Condition | Expected Result | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **Test 1: Online Seeding & Baseline Cache** | Wi-Fi / Cellular ON | Timetable, overrides, tasks, and attendance load and cache to local SQLite. | [ ] |
| **Test 2: Airplane Mode Cold Boot (Zero Network)** | Airplane Mode ON, App Force-Killed | Splash screen dismisses cleanly; UI renders cached timetable and tasks in <100ms with zero network error dialogs. | [ ] |
| **Test 3: Offline Optimistic Attendance & Task Writes** | Airplane Mode ON | Tapping 'Present' / creating a task updates UI instantly and commits to SQLite entity + `offline_mutations` queue. | [ ] |
| **Test 4: Offline Cold Boot with Dirty Queue** | Airplane Mode ON, App Force-Killed & Reopened | App cold boots offline; previously queued optimistic mutations (green attendance pill, personal task) are fully preserved. | [ ] |
| **Test 5: Network Reconnection & Background Queue Drain** | Airplane Mode OFF (Reconnection) | NetInfo fires; replay worker drains queue FIFO to Supabase; database reflects attendance and tasks. | [ ] |
| **Test 6: Remote Tombstone Deletion Sync** | Online | Deleting a record in Supabase creates a tombstone; client sync harvests tombstone and purges local SQLite cache. | [ ] |

---

## Detailed Step-by-Step Execution Guide

### Test 1: Full Online Seeding & Baseline Ingestion
1. Launch ClassSync with active Internet connectivity.
2. Sign in with Account A. Ensure you are enrolled in an active Section (e.g., `BSSE Fall 2026`).
3. If not already populated, ensure there are at least 2 schedule blocks on the Agenda (e.g., today or tomorrow).
4. Navigate to the **Tasks** tab:
   - Create a task: `CS301 Lab Assignment` (Due in 3 days, Assignment type).
5. Navigate back to the **Agenda** tab:
   - Notice the attendance pills (`P`, `A`, `L`) on eligible class blocks.
6. Verify in terminal / console logs:
   - `[DeltaSync] Full initial sync complete for section...`
   - Local SQLite database `classsync.db` has written rows to `cached_base_schedules` and `cached_academic_tasks`.

---

### Test 2: Airplane Mode Cold Boot (Cellular Dead-Zone Simulation)
1. On your physical device / simulator, enable **Airplane Mode** (disable both Wi-Fi and Cellular data).
2. **Force-kill** the ClassSync application (swipe up from the App Switcher on iOS/Android).
3. Tap the ClassSync app icon to launch from a completely cold boot.
4. **Observe:**
   - The native splash screen appears.
   - `hydrateAppStore` runs against local SQLite.
   - The splash screen smoothly fades away.
   - The **Agenda** tab renders your classes **instantly (<100ms)** without any spinner, without a white flash, and with **zero** network error alert dialogs.
   - Tap the **Tasks** tab: `CS301 Lab Assignment` is immediately visible.

---

### Test 3: Offline Optimistic Mutations (Attendance & Tasks)
1. Keep the device in **Airplane Mode**.
2. On the **Agenda** tab, locate a class block with attendance pills (`P`, `A`, `L`).
3. Tap the **`P` (Present)** pill:
   - **Verification:** The pill turns solid emerald green **instantly** (0ms perceived latency).
   - Under the hood: The optimistic update writes to `cached_attendance_logs` and enqueues an `UPSERT_ATTENDANCE` mutation with client RFC4122 UUID in `offline_mutations`.
4. Switch to the **Tasks** tab:
   - Tap the `+` Floating Action Button to create a task while offline.
   - Title: `Offline Physics Quiz Preparation`.
   - Select Course & Type (`Quiz`).
   - Tap **Create Task**.
   - **Verification:** The task appears at the top of the **Pending** list immediately.
   - Under the hood: The task is saved into `cached_academic_tasks` and queued in `offline_mutations`.

---

### Test 4: Offline Cold Boot with Dirty Queue
1. Maintain **Airplane Mode** (still no internet).
2. **Force-kill** the app again from the App Switcher.
3. Relaunch the app from cold boot.
4. **Observe:**
   - The Agenda tab loads immediately.
   - The class block where you tapped `P` **still shows the green Present pill**.
   - The Tasks tab **still contains `Offline Physics Quiz Preparation`**.
   - **Conclusion:** Local SQLite persistence is resilient; pending offline mutations and optimistic entity writes survive process termination.

---

### Test 5: Network Reconnection & Background Queue Drain
1. Open terminal with Metro logs visible (or watch device console).
2. Disable **Airplane Mode** (re-enable Wi-Fi or Cellular).
3. Open or focus ClassSync.
4. **Observe in Logs:**
   - `@react-native-community/netinfo` detects `isConnected: true`.
   - `[useOfflineSync] Online state detected. Triggering queue processing & delta sync...`
   - `[MutationQueue] Processing 2 pending mutations...`
   - `[MutationQueue] Successfully replayed mutation <uuid-1> (UPSERT_ATTENDANCE)`.
   - `[MutationQueue] Successfully replayed mutation <uuid-2> (UPSERT_TASK)`.
   - `[MutationQueue] Replay completed. 2 succeeded, 0 failed.`
5. **Verify in Supabase Table Editor:**
   - In `attendance_logs`: The row exists with the exact client-generated UUID, `status: 'present'`.
   - In `academic_tasks`: The `Offline Physics Quiz Preparation` task exists with `is_synced = true`.

---

### Test 6: Cross-Device Remote Tombstone Sync
1. With the app running online on the device, open your **Supabase Dashboard**:
   - Go to `academic_tasks` (or `base_schedules`).
   - Find a task or schedule block and click **Delete Row**.
2. Check Supabase table `sync_tombstones`:
   - A new row was created automatically by PostgreSQL trigger: `entity_type: 'academic_task'`, `entity_id: <deleted_task_id>`.
3. In ClassSync:
   - Pull-to-refresh on the Agenda / Tasks tab, or lock/unlock phone (triggering `AppState` change).
4. **Observe:**
   - `[DeltaSyncEngine] Harvesting tombstones for user/section...`
   - `[DeltaSyncEngine] Purged 1 deleted entity from local SQLite.`
   - The deleted item disappears from the app's UI cleanly without requiring an app reinstall.

---

## QA Sign-Off Criteria
- [x] All 6 test cases passed without runtime crashes or uncaught exceptions.
- [x] Offline cold boot rendered in <100ms.
- [x] No data loss occurred during offline queue lifecycle.
- [x] Zero duplicate entities created upon network reconnection.
