# Production Push Credentials Setup Guide (APNs & FCM v1)

This document provides step-by-step instructions for configuring native Apple Push Notification service (APNs) and Google Firebase Cloud Messaging (FCM v1) production credentials for **ClassSync** (`com.classsync.app`).

---

## 1. Architecture Overview

ClassSync dispatches push notifications through a high-availability pipeline:
```
[PostgreSQL Triggers / Supabase Edge Functions]
                      ↓
           [Expo Push API Gateway]
            ↙                  ↘
  [Apple APNs (HTTP/2)]    [Google FCM (v1 API)]
            ↓                          ↓
    [iOS Devices]             [Android Devices]
```

To ensure delivery reliability and avoid throttling, both platforms require authenticated credentials configured in Expo Application Services (EAS).

---

## 2. Apple Push Notification service (APNs) Setup

Apple requires an APNs Authentication Token (`.p8` key) associated with your Apple Developer Account.

### Step 2.1: Generate `.p8` Key in Apple Developer Portal
1. Navigate to [developer.apple.com/account](https://developer.apple.com/account).
2. Go to **Certificates, Identifiers & Profiles** &rarr; **Keys**.
3. Click the **+** (plus) icon to register a new key.
4. Set Key Name: `ClassSync APNs Production Key`.
5. Check the box for **Apple Push Notifications service (APNs)**.
6. Click **Continue** and **Register**.
7. Download the `.p8` key file (e.g., `AuthKey_XXXXXXXXXX.p8`).
   > ⚠️ **Important:** Apple only permits downloading this key *once*. Store it securely in a password manager or corporate vault.

### Step 2.2: Note Identifier Credentials
Record the following metadata:
- **Key ID:** 10-character alphanumeric string (shown next to the key).
- **Apple Team ID:** 10-character string found under your Apple Developer Account Membership details.
- **Bundle ID:** `com.classsync.app`.

### Step 2.3: Link Credentials to EAS
Run the following interactive CLI command in the repository root:
```bash
npx eas credentials -p ios
```
1. Select **Production** profile.
2. Select **Push Notifications: Apple Push Notification service (APNs)**.
3. Select **Upload an existing APNs Key**.
4. Provide the `.p8` file path, Key ID, and Team ID.

---

## 3. Google Firebase Cloud Messaging (FCM v1) Setup

Google requires FCM HTTP v1 credentials backed by a Google Cloud Service Account JSON key.

### Step 3.1: Create/Open Firebase Project
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Create or select the `ClassSync` project.
3. Add an Android app with package name: `com.classsync.app`.
4. Download `google-services.json` and place it in the project root if using bare workflow (or configure in EAS).

### Step 3.2: Generate Service Account Key (FCM v1)
1. In Firebase Console, click the gear icon &rarr; **Project Settings**.
2. Select the **Service accounts** tab.
3. Under **Firebase Admin SDK**, verify **Node.js** is selected.
4. Click **Generate new private key** &rarr; confirm **Generate key**.
5. Save the downloaded JSON file (e.g., `classsync-firebase-adminsdk-xxxxx.json`).

### Step 3.3: Link FCM Key to EAS
Run:
```bash
npx eas credentials -p android
```
1. Select **Production** build profile.
2. Select **Google Service Account Key for FCM v1 (Server Credentials)**.
3. Provide the path to the downloaded service account `.json` file.

---

## 4. Verification & Smoke Test

Once credentials are uploaded, verify push delivery using the Expo Push Tool:

### Test Payload (Urgent Override Alert)
Send a POST request to `https://exp.host/--/api/v2/push/send`:
```json
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "🚨 Class Relocation Alert",
  "body": "Calculus II has been moved to Room 402.",
  "sound": "default",
  "badge": 1,
  "channelId": "urgent-class-alerts",
  "priority": "high",
  "data": {
    "url": "/(tabs)/agenda",
    "eventCategory": "schedule_override",
    "overrideId": "ovr-test-123"
  }
}
```

### Verification Checklist:
- [ ] iOS receives banner with sound and badge.
- [ ] Android receives notification categorized under the `urgent-class-alerts` channel with heads-up display.
- [ ] Tapping the notification deep-links directly to the target Agenda screen via `useNotificationRouting`.
