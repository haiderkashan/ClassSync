# ClassSync — Production Store Launch Checklist (v1.0.0)

This runbook provides the definitive, step-by-step procedures for compiling, signing, testing, and submitting **ClassSync** (`com.classsync.app`) to both the **Apple App Store** and the **Google Play Store**.

---

## 📋 Pre-Flight Technical Verification

Before triggering any cloud builds, verify that your local repository is 100% clean and passing all compliance gates:

```bash
# 1. Verify strict TypeScript compilation (must exit 0 with no errors)
npx tsc --noEmit

# 2. Run full automated test suite (must pass 24 suites, 277 tests)
npm test

# 3. Test web export bundler (must bundle 3,350+ modules cleanly with 0 errors)
npx expo export --platform web

# 4. Verify clean git working tree
git status
```

---

## 🛠️ Step 1: EAS CLI Authentication & Project Linking

Ensure the Expo Application Services (EAS) CLI is authenticated with your Expo account:

```bash
# Log in to your Expo account
npx eas login

# Verify current logged-in identity
npx eas whoami

# Link the local repository to your EAS project (if not already linked)
npx eas project:init
```

---

## 🔑 Step 2: Push Notification & Code Signing Credentials

ClassSync requires native push credentials for Apple APNs and Google Firebase Cloud Messaging (FCM v1).

### 2.1 Apple iOS Credentials
Run:
```bash
npx eas credentials -p ios
```
1. Select **Production** build profile.
2. Select **Distribution Certificate** &rarr; Let EAS automatically generate or upload your Apple Distribution Certificate.
3. Select **Provisioning Profile** &rarr; Let EAS automatically generate the profile for bundle ID `com.classsync.app`.
4. Select **Push Notifications: Apple Push Notification service (APNs)** &rarr; **Upload an existing APNs Key**:
   - Provide path to downloaded `AuthKey_XXXXXXXXXX.p8` from Apple Developer Portal.
   - Enter **Key ID** (10 characters).
   - Enter **Apple Team ID** (10 characters).

### 2.2 Google Android Credentials
Run:
```bash
npx eas credentials -p android
```
1. Select **Production** build profile.
2. Select **Android App Bundle (.aab) Keystore** &rarr; Let EAS generate a new keystore (or upload your existing release keystore).
3. Select **Google Service Account Key for FCM v1 (Server Credentials)**:
   - Provide path to the downloaded Firebase Admin SDK Service Account JSON file (e.g. `classsync-firebase-adminsdk.json`).

---

## 📦 Step 3: Generating Production Release Builds

### 3.1 Optional: Internal Physical Android QA (Standalone APK)
To install and test on a physical Android device without waiting for Google Play review:
```bash
npx eas build --profile preview --platform android
```
*Download and install the resulting `.apk` on test devices.*

### 3.2 Production Binaries (Google Play AAB & Apple App Store IPA)
Trigger simultaneous production cloud builds for both platforms:
```bash
npx eas build --profile production --platform all
```
*Or build platforms individually:*
```bash
# Build iOS Archive (.ipa) for App Store Connect
npx eas build --profile production --platform ios

# Build Android App Bundle (.aab) for Google Play Console
npx eas build --profile production --platform android
```

---

## 🍎 Apple App Store Submission Procedures

### 1. App Store Connect Setup
1. Log in to [App Store Connect](https://appstoreconnect.apple.com/).
2. Navigate to **Apps** &rarr; Click **+** (New App).
3. Fill in basic metadata:
   - **Platforms:** iOS
   - **Name:** `ClassSync`
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** `com.classsync.app`
   - **SKU:** `classsync-app-ios`
   - **User Access:** Full Access

### 2. TestFlight Verification
1. Once the EAS iOS production build completes, it will automatically appear under the **TestFlight** tab in App Store Connect (or submit via `npx eas submit --platform ios`).
2. Add internal testers to the build.
3. Install the build via the **TestFlight app** on a physical iPhone and verify:
   - [ ] Sign in with Apple and Google completes smoothly.
   - [ ] Section creation and QR code generation display correctly.
   - [ ] Camera permissions prompt (`NSCameraUsageDescription`) appears when tapping "Scan QR".
   - [ ] Account Deletion modal functions and requires typing "DELETE".

### 3. App Privacy Questionnaire (Nutrition Labels)
In App Store Connect under **App Privacy**:
- **Data Collection:** Select **Yes, we collect data from this app**.
- **Data Types Declared (matching `app.json` Privacy Manifest):**
  - **Email Address:** Used for *App Functionality*, linked to the user's identity.
  - **User ID:** Used for *App Functionality*, linked to the user's identity.
  - **Device ID:** Used for *App Functionality* (Push notification routing via APNs).
- **Tracking:** Select **No, we do not use data for tracking purposes**.

### 4. General App Information & Review Submission
- **Support URL:** `https://classsync.app/support` (Hosted version: `docs/legal/support.html`)
- **Privacy Policy URL:** `https://classsync.app/privacy` (Hosted version: `docs/legal/privacy-policy.html`)
- **Category:** Primary: *Education*, Secondary: *Productivity*
- **Content Rights & Export Compliance:** Check **Yes** to uses encryption, and check **No** to non-exempt encryption (matches `ITSAppUsesNonExemptEncryption: false` in `app.json`).
- Submit for **App Review**.

---

## 🤖 Google Play Console Submission Procedures

### 1. Create Application
1. Log in to the [Google Play Console](https://play.google.com/console).
2. Click **Create app**:
   - **App name:** `ClassSync`
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free
3. Accept Developer Program Policies and US Export Laws.

### 2. Internal Testing Track
1. Navigate to **Testing** &rarr; **Internal testing**.
2. Click **Create new release**.
3. Upload the `.aab` file generated by `eas build --profile production --platform android`.
4. Release name: `1.0.0 (1)`.
5. Save and rollout to Internal Testers.

### 3. App Content & Data Safety Declarations
In Google Play Console under **Policy and programs** &rarr; **App content**:
- **Privacy Policy:** Paste live URL `https://classsync.app/privacy` (from `docs/legal/privacy-policy.html`).
- **Account Deletion URL (Mandatory):**
  - Paste live URL: `https://classsync.app/support#deletion` (from `docs/legal/support.html`).
  - Confirm the page describes that users can delete their account directly in the app (Settings &rarr; Delete Account) or request manual deletion via email to `support@classsync.app`.
- **Data Safety Form:**
  - Does your app collect or share user data? **Yes**.
  - Is all user data collected encrypted in transit? **Yes** (HTTPS/TLS 1.3).
  - Do you provide a way for users to request data deletion? **Yes** (Direct in-app deletion).
  - Data types collected:
    - *Personal info:* Name, Email address, User IDs.
    - *Device or other identifiers:* Device ID (for Firebase Cloud Messaging).
- **Target Audience:** Select **18 and over** and **13-17** (Higher-education and college students).

### 4. Store Listing Assets
- **App icon:** 512 x 512 px PNG (32-bit with alpha).
- **Feature graphic:** 1024 x 500 px JPEG or PNG.
- **Phone Screenshots:** At least 4 screenshots (Agenda tab, Timetable Builder, Attendance Analytics, Presenter HUD).
- **Short description (80 chars max):**
  `Live university timetables, peer-verified cancellations, and cohort schedules.`
- **Full description:** Use content from `README.md` highlighting offline-first SQLite, bi-weekly parity, and decentralized consensus.

### 5. Final Rollout
1. Promote the approved internal release to **Production** track.
2. Click **Start rollout to Production**.

---

## 🎯 Post-Launch Monitoring Checklist

Once the application is live in both stores:
- [ ] Monitor Supabase Dashboard for database connection pool utilization and RLS policy logs.
- [ ] Check Clerk Dashboard for active production sessions and OAuth token issuances.
- [ ] Send test urgent class override alert to confirm APNs and FCM v1 delivery rates.
- [ ] Review Google Play Android Vitals for 0% crash rate and ANR metrics.
- [ ] Review App Store Connect Crashlytics & Analytics reports.
