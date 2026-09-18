# Product Requirements Document (PRD) — ClassSync Global

**Project Name:** ClassSync  
**Document Version:** 2.0 (Global Production Architecture)  
**Target Platforms:** iOS (Apple App Store) & Android (Google Play Store)  
**Product Lead / Architect:** Kashan Haider & Antigravity Architecture Team  
**Tech Stack:** React Native (Expo), Supabase (PostgreSQL + Realtime), Clerk (Auth), Expo Push Notifications  

---

## 1. Executive Summary

### 1.1 The Problem
University and college academic logistics across the globe are fragmented across bloated, unorganized channels: noisy WhatsApp/Telegram/Discord groups, clumsy LMS platforms (Canvas, Blackboard, Moodle), and static PDF/Excel timetables that break the moment reality intervenes. 

When a lecture is moved, delayed by 15 minutes, or cancelled last-minute, students suffer from:
1. **Information Asymmetry:** Critical updates are drowned out by peer chat or missed entirely.
2. **The "Irregular" Student Penalty:** Students repeating a course, taking cross-departmental electives, or on exchange programs receive spam notifications from cohorts they don't belong to or miss single-class updates.
3. **Admin Burnout:** Class Representatives (CRs), Student Delegates, and Cohort Admins are constantly inundated with repetitive messages: *"Is class happening?", "What room are we in?", "Is the professor on leave?"*

### 1.2 The Solution
**ClassSync** is a mobile-only, peer-orchestrated academic hub that centralizes timetables, tracks deadlines, and delivers sub-second, real-time class status updates (*Scheduled*, *Started*, *Delayed*, *Cancelled*, *Room Moved*, *Instructor Away*) via targeted push notifications. 

Built on a deterministic **"Base Schedule + Dynamic Override"** timetable engine and an atomic **"Course-Level vs. Cohort-Level"** subscription model, ClassSync eliminates repetitive queries, ensures zero data-entry burden on standard students, and respects academic schedules worldwide.

### 1.3 Vision & Strategic Positioning
To become the global de-facto standard mobile companion for higher-education student cohorts—usable by any student in any degree program from Harvard to Oxford to the National University of Singapore to NUST—without requiring institutional bureaucracy, enterprise procurement, or IT integration.

---

## 2. Global Market Constraints & Architecture Tenets

1. **Zero Web Requirement (Strictly Mobile-Only):** The product is engineered purely for iOS and Android using React Native (Expo). Class Admins and students manage everything directly from their mobile devices.
2. **Multi-Tenant & Decentralized Discovery:** Any student can launch a Workspace for their university cohort in under 60 seconds. No .edu domain verification is mandated for basic use, but institution tagging prevents naming collisions.
3. **Timezone & Calendar Agnosticism:** Cohorts operate in their local IANA timezone with full support for standard Monday–Friday, Sunday–Thursday (Middle East / MENA), alternating A/B (odd/even) weeks, and custom semester/trimester/quarter lengths.
4. **Offline-First Resilience:** Lecture halls and campus basements often suffer from poor cellular connectivity. The entire base timetable and cached overrides must be queryable and viewable instantly without an active internet connection.

---

## 3. Global Terminology & Taxonomy

To ensure worldwide usability without regional friction, ClassSync adopts a flexible, universally understood taxonomy:

| Regional / Legacy Term | ClassSync Standard Term | Definition |
| :--- | :--- | :--- |
| **CR / GR / Delegate / Course Rep** | **Class Admin / Delegate** | The verified student leader who manages the schedule and broadcasts live status changes. |
| **Section / Batch / Stream / Class** | **Cohort / Workspace** | The primary container representing a specific class year, major, or degree group (e.g., *"Computer Science Class of 2027 - Sec B"*). |
| **Subject / Course / Unit** | **Course / Module** | An individual academic subject (e.g., *"Data Structures & Algorithms"*). |
| **Lab / Lecture / Tutorial / Seminar** | **Session Type** | The operational format of the class block. |
| **Section Student** | **Cohort Member** | A student enrolled in the full cohort bundle with course toggle controls. |
| **Irregular / Retake Student** | **Guest Member** | A student who only joins a single isolated course via a Course Deep-Link. |

---

## 4. User Personas & Permissions Matrix

### 4.1 Personas

1. **The Lead Admin (Founder):**
   - *Profile:* The elected Class Representative, Student Delegate, or proactive student who initializes the Workspace.
   - *Jobs to be Done:* Set up the weekly timetable once at the start of term, distribute invite links, delegate Co-Admin roles, and initiate end-of-term archival.

2. **The Co-Admin (Deputy Delegate):**
   - *Profile:* Assistant CRs, Course TAs, or trusted peers.
   - *Jobs to be Done:* Broadcast day-to-day status updates (e.g., *"Prof running 10m late"*), add assignments/quizzes, and update room locations when the Lead Admin is unavailable.

3. **The Regular Cohort Member:**
   - *Profile:* Full-time enrolled student following standard curriculum.
   - *Jobs to be Done:* Glance at "Today/Tomorrow" widget, receive instant alerts for cancellations/delays, track personal assignments, toggle off dropped elective courses.

4. **The Cross-Cohort / Guest Member:**
   - *Profile:* A student retaking a failed module, an exchange student, or an advanced credit student.
   - *Jobs to be Done:* Join *only* "Web Engineering" via an isolated course link without being bombarded with the rest of another cohort's timetable or announcements.

### 4.2 Role-Based Permissions Matrix

| Capability | Lead Admin | Co-Admin | Cohort Member | Guest Member |
| :--- | :---: | :---: | :---: | :---: |
| Create Workspace / Cohort | ✅ | ❌ | ❌ | ❌ |
| Edit Workspace Settings & Timezone | ✅ | ❌ | ❌ | ❌ |
| Create / Edit Base Timetable Loop | ✅ | ✅ | ❌ | ❌ |
| Broadcast Live Status Override | ✅ | ✅ | ❌* | ❌ |
| Change Class Room / Location (Temporary) | ✅ | ✅ | ❌ | ❌ |
| Add / Edit Academic Tasks (Deadlines) | ✅ | ✅ | ❌ | ❌ |
| Generate Cohort Invite Link / QR Code | ✅ | ✅ | ❌ | ❌ |
| Generate Single Course Deep-Link | ✅ | ✅ | ❌ | ❌ |
| Promote / Demote Co-Admins | ✅ | ❌ | ❌ | ❌ |
| Transfer Lead Admin Ownership | ✅ | ❌ | ❌ | ❌ |
| Archive / End Term | ✅ | ❌ | ❌ | ❌ |
| Toggle Course Notifications On/Off | N/A | N/A | ✅ (Own) | ❌ (Fixed) |
| Mark Personal Tasks Complete | ✅ | ✅ | ✅ | ✅ |
| Create Personal Private Blocks | ✅ | ✅ | ✅ | ✅ |
| Upvote / Peer-Verify Status (Crowd Fallback) | ✅ | ✅ | ✅ | ✅ |

*\*Note: Regular members can contribute to status verification via Crowd Fallback (see Section 6).*

---

## 5. Core Architectural Engines

### 5.1 Deterministic Timetable Engine (Base Loop + Exception Overrides)

The scheduling system solves the tension between static, recurring schedules and unpredictable daily campus life through a three-layer resolution engine:

```
[Layer 1: Base Recurring Schedule]
        │
        ├── (Evaluated against Week Calendar & Alternating Week Rules A/B)
        ▼
[Layer 2: Date-Specific Overrides / Exceptions]
        │
        ├── (Replaces status, adjusts start time, changes room, or flags cancellation)
        ▼
[Layer 3: Ad-Hoc / Makeup Class Injections]
        │
        ├── (Standalone single-instance events injected into the day's timeline)
        ▼
[Compiled Daily View Delivered to Client]
```

1. **Base Loop:** Defines standard recurring weekly templates. Each record specifies `day_of_week` (1=Mon ... 7=Sun), `start_time`, `end_time`, `course_id`, `room`, `session_type`, and `frequency` (`weekly`, `biweekly_week_a`, `biweekly_week_b`).
2. **Exception Overrides:** When an Admin alters an instance, an immutable `schedule_exceptions` record is created for that specific `(base_schedule_id, date)` tuple. Overrides include:
   - `CANCELLED`: Class will not take place.
   - `DELAYED`: Start time shifted by `+N` minutes.
   - `ROOM_MOVED`: Temporary relocation.
   - `STARTED`: Real-time confirmation that class is underway.
   - `INSTRUCTOR_AWAY`: Known faculty absence.
3. **Ad-Hoc / Makeup Injections:** Standalone records bound to a specific `date` and `time_range` without a recurring parent.

### 5.2 Atomic "Bundle & Toggle" Subscription Engine

- When a student joins a Cohort Workspace, they are enrolled in the **Cohort Bundle**.
- The student's settings allow granular toggles for each course within the cohort.
- Dropping a course locally:
  1. Hides the course from their daily agenda.
  2. Updates their notification registry in Supabase so push alerts for that course are suppressed.
- **Guest Subscriptions:** Guests join via an encrypted token mapped directly to a single `course_id`. They possess zero read access to other cohort courses, members, or tasks.

---

## 6. High-Value Global Features (Competitive Edge)

To make ClassSync globally compelling without feature-bloat, the following five focused capabilities are natively integrated:

### Feature 1: Bi-Weekly / Alternating Timetable Support (Week A / Week B)
- **Problem:** Many universities in the UK, Europe, Australia, and North America operate on alternating schedules (e.g., Lab on Week 1/A, Seminar on Week 2/B).
- **Implementation:** Workspaces can configure an "Alternating Cycle" (Odd/Even ISO calendar week or user-defined starting week anchor). Base schedule items can be tagged as `Weekly`, `Week A Only`, or `Week B Only`.

### Feature 2: In-Room "Presenter QR" & Universal Deep-Links
- **Problem:** Onboarding an entire lecture hall of 120+ students via 6-digit codes typed manually is slow and error-prone.
- **Implementation:** 
  - Class Admins tap "Present QR" on their phone. It generates an oversized, high-contrast QR code with the cohort's dynamic joining token.
  - One-tap Universal Deep-Links (`https://classsync.app/join/[token]`) can be dropped into class group chats (WhatsApp/Telegram/Discord). A single tap authenticates through Clerk (Google/Apple Sign-In) and drops the student into the active cohort in <10 seconds.

### Feature 3: One-Tap Native Device Calendar Export (iOS EventKit & Android Calendar)
- **Problem:** Students don't want to live exclusively inside one app; they use Apple Calendar, Google Calendar, or Notion to manage their personal and academic lives.
- **Implementation:** With a single button press, ClassSync synchronizes enrolled classes directly into a sandboxed device calendar (`"ClassSync - [Cohort Name]"`). The app periodically refreshes the local calendar via background tasks, reflecting changes and cancellations natively.

### Feature 4: Crowd-Sourced "Peer Verification" Status Fallback
- **Problem:** If the designated Class Admin is absent, caught in traffic, or forgets to update the app, students are left guessing.
- **Implementation:** 
  - When a class is 5 minutes past start time and still marked `Scheduled`, any verified Cohort Member can submit a **"Peer Report"** (e.g., *"Teacher arrived"* or *"Room locked / empty"*).
  - When **3 distinct cohort members** corroborate the status within a 10-minute window, a provisional status badge is displayed to the entire cohort: *"Peer Verified (3): Class Started"*, with a 1-tap option for the Admin to confirm or override.

### Feature 5: Smart Syllabus & Task Quick-Paste Parser
- **Problem:** Manual input of 10+ assignment deadlines and exam dates across 5 courses at the start of a semester leads to admin abandonment.
- **Implementation:** A frictionless batch task creator where an Admin can paste structured text (e.g., *"Midterm: Oct 24, Quiz 1: Nov 05, Final Project: Dec 12"*) or enter multi-line deadlines. The client parses dates and courses with instant previews, saving hours of manual data entry.

---

## 7. Functional Requirements (FR)

### 7.1 Identity, Authentication & Onboarding
- **FR 1.1:** Authentication handled via Clerk Expo SDK supporting Google Sign-In and Apple Sign-In (mandatory for App Store approval).
- **FR 1.2:** Seamless session exchange with Supabase using Clerk-issued custom JWTs.
- **FR 1.3:** Empty state routing: New users are presented with two primary actions: **"Join Cohort"** (QR scan, link, or code) and **"Create Cohort"**.
- **FR 1.4:** Guest Mode: Opening a Course Deep-Link automatically provisions the student as a Guest Member of that specific course upon sign-in.

### 7.2 Workspace & Cohort Management
- **FR 2.1:** Any authenticated user can create a Workspace specifying:
  - Cohort Title (e.g., *"Mechanical Engineering 2026"*)
  - Institution / University Tag (e.g., *"Imperial College London"*)
  - IANA Timezone (auto-detected from device, editable)
  - Timetable Cycle Mode (Weekly vs. Week A/B alternating)
- **FR 2.2:** Each cohort generates a unique cryptographically secure 7-character alphanumeric Join Code and a Universal Link.
- **FR 2.3:** The Lead Admin can view the cohort roster, promote members to Co-Admin, remove members, or transfer ownership.
- **FR 2.4:** Single-Course Link Generator: Admins can generate isolated invite links for individual courses without exposing the full cohort.

### 7.3 Timetable & Live Status Engine
- **FR 3.1:** **Base Timetable Builder:** Mobile-optimized visual schedule builder allowing Admins to set recurring class blocks by Day of Week, Start/End Time, Course, Room, Session Type, and Week Cycle.
- **FR 3.2:** **Admin Quick-Action Bar:** Displays the current ongoing class and the immediate next class within 12 hours.
- **FR 3.3:** **Instant Status Broadcast:** Admins can trigger a status change in 2 taps:
  - 🟢 **Scheduled** (Default)
  - 🔵 **Started / In Progress**
  - 🟡 **Delayed** (Select duration: +5m, +10m, +15m, +30m, or custom)
  - 🔴 **Cancelled**
  - 📍 **Room Changed** (Quick room input)
  - 🟣 **Instructor Away**
- **FR 3.4:** Real-time synchronization: Status changes broadcast through Supabase Realtime channels to all active clients within <500ms.
- **FR 3.5:** Push Dispatch: Any status change triggering an override dispatches a high-priority push notification to all enrolled, non-muted students.
- **FR 3.6:** **Makeup Class Injections:** Admins can schedule ad-hoc makeup classes with specific date, time, room, and push broadcast.

### 7.4 Student Daily Agenda & Deadline Tracking
- **FR 4.1:** **Focused Daily View:** Home screen displays a clean, distraction-free agenda showing **"Today"** and **"Tomorrow"**, with an expandable 7-day mini-calendar strip.
- **FR 4.2:** **Status Indicators:** Every class card visually reflects its real-time state with dynamic countdowns (e.g., *"Starts in 12 min"*, *"Delayed to 10:15 AM"*).
- **FR 4.3:** **Course Toggle Drawer:** Cohort Members can open course settings to toggle off specific courses they are not attending.
- **FR 4.4:** **Academic Tasks / Deadlines:** Admins can publish Assignments, Quizzes, Projects, and Presentations tied to specific courses.
- **FR 4.5:** **Personal Task Completion:** Students can swipe or tap tasks to toggle personal completion status (stored in local device storage and synced to user profile).
- **FR 4.6:** **Private Events:** Students can inject personal calendar blocks (e.g., *"Study Group"*, *"Gym"*) visible exclusively to themselves.

### 7.5 Semester Lifecycle & Archival
- **FR 5.1:** **End-of-Term Archive:** Lead Admin can execute an "Archive Term" action. 
- **FR 5.2:** Archival freezes the timetable, marks all outstanding tasks as archived, and provides an exportable summary.
- **FR 5.3:** **Auto-Eviction of Guests:** When a term is archived, all Guest Members attached to individual courses are automatically detached to prevent orphaned access.
- **FR 5.4:** **Next-Term Migration:** Lead Admins can clone course definitions and student rosters into a new term with a fresh timetable.

---

## 8. Non-Functional Requirements (NFR)

### 8.1 Offline Capability & Sync
- **NFR 1.1:** Zero-network launch: The client must open and display the complete cached timetable and latest known status updates in <200ms without an active internet connection.
- **NFR 1.2:** Stored locally using a high-performance offline store (WatermelonDB / Expo SQLite with MMKV cache).
- **NFR 1.3:** Seamless reconnection: When network connectivity is restored, the client silently queries delta changes and updates the cache.

### 8.2 Push Notification Governance & Quiet Hours
- **NFR 2.1:** **Smart Quiet Hours:** Non-urgent updates (new assignments, general notes posted between 10:00 PM and 7:00 AM in the user's local timezone) are queued and delivered at 7:30 AM local time.
- **NFR 2.2:** **Urgent Overrides Bypass Quiet Hours:** Same-day class cancellations, delays, or immediate room relocations bypass quiet hours instantly.
- **NFR 2.3:** **Delivery Throttling:** Rapid admin status adjustments (e.g., tapping "Delayed" then immediately "Cancelled") are debounced by 45 seconds to prevent notification spam.

### 8.3 Performance & Global Scale
- **NFR 3.1:** Supabase Realtime latency must remain <500ms globally (P95) via regionally optimized database replicas and WebSocket channels.
- **NFR 3.2:** Database schema must strictly enforce Row Level Security (RLS) on every table, guaranteeing zero cross-tenant data leaks.
- **NFR 3.3:** Image & asset payloads must be strictly constrained; avatars and icons are optimized and cached to prevent unnecessary cellular data consumption.

### 8.4 Privacy, Security & Store Compliance
- **NFR 4.1:** **Apple App Store & Google Play Guidelines:** Strict adherence to Apple Human Interface Guidelines and Google Material 3. Includes mandatory "Delete Account" and data purge functionality in settings.
- **NFR 4.2:** **Zero PII Exposure:** Member rosters display only first name and profile avatar. Email addresses and Clerk user IDs are never exposed to other students.
- **NFR 4.3:** **GDPR / FERPA Considerations:** No academic grading, transcript data, or official student ID numbers are ever processed or stored.

---

## 9. Success Metrics (KPIs)

1. **Daily Active Engagement:** Daily Active Users (DAU) / Weekly Active Users (WAU) ratio > 65% during active academic terms.
2. **Onboarding Velocity:** New student time-to-first-timetable < 15 seconds via QR scan or Deep-Link.
3. **Status Accuracy & Latency:** Time from Admin status tap to peer push notification delivery < 2.5 seconds globally.
4. **Admin Retention:** > 80% of active Cohorts maintained across the full duration of a semester.
