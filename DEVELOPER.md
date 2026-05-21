# Pulse • EMS Exercise Timer — Developer Guide

This document is a technical guide for developers working on the **Pulse • EMS Exercise Timer** application. It details local setup, the development cycle, build pipelines, and how to compile the application for both web and native Android platforms.

---

## 🛠️ Technology Stack
* **Web Core:** React (v19), TypeScript, Vite (v6), Tailwind CSS (v4)
* **Native Container:** Ionic Capacitor (v8)
* **Build Systems:** npm, Gradle (Android)

---

## 💻 Environment Setup
Before making changes to the application, ensure your computer has the following tools installed:

1. **Node.js:** v18.x or newer (includes `npm`).
2. **Java Development Kit (JDK):** JDK 17 (required for Capacitor v8 / modern Android Gradle builds).
3. **Android Studio:** Download and install [Android Studio](https://developer.android.com/studio).
   * Ensure you have installed the **Android SDK** (API Level 34 or higher is recommended).
   * Set up at least one **Virtual Device (Emulator)** in the Device Manager, or have a physical Android phone with USB Debugging enabled.

---

## 🔄 Step-by-Step Development Workflow

### Step 1: Install Dependencies
Open your terminal in the root folder of this project (`/pulse-ems-exercise-timer-app`) and run:
```bash
npm install
```

### Step 2: Run the Web App Locally (Iterative Development)
To launch the hot-reloading web development server:
```bash
npm run dev
```
* The app will open at `http://localhost:3000` (or another port shown in the terminal).
* Any changes you make to the React files inside the `src/` folder will automatically hot-reload in the browser.

### Step 3: Making Changes to the Code
* **UI & Workouts:** The main container logic is in `src/App.tsx`.
* **Sub-Components:** Located in `src/components/`:
  * `Waveform.tsx`: Controls the EMS contraction/relaxation pulse graphic.
  * `PhysioSchedule.tsx`: Manages individual exercise customization and calendar assignments.
  * `AnalyticsPanel.tsx`: Houses the calendar logs and user statistics.
  * `SettingsPanel.tsx`: Handles volume, sound tones, metronome, wake-lock, and vibration options.
* **Audio Cues:** Audio configuration and audio synthesis engine is in `src/lib/audio.ts`.

---

## 📦 Compiling and Syncing to Android

Whenever you are ready to test your changes inside the Android container or emulator, follow this compilation pipeline:

### 1. Build the Web Distribution
Compile your optimized React/TypeScript web assets:
```bash
npm run build
```
*This outputs production-grade assets into the `/dist` folder.*

### 2. Synchronize Assets with Capacitor
Copy your compiled web assets directly into the native Android folder assets directory:
```bash
npx cap sync
```
*This updates the Android native container with your latest code.*

### 3. Open the Android Project
To test, debug, or build the app:
* **Via Android Studio (Recommended for debugging & emulators):**
  ```bash
  npx cap open android
  ```
  This will boot up Android Studio with the correct context. Click the green **Run (Play)** button to launch it on an emulator or connected physical device.
  
* **Via Terminal CLI (Faster for compilation):**
  To assemble a debug APK directly from your terminal:
  ```bash
  cd android && ./gradlew assembleDebug
  ```
  The compiled `.apk` will be outputted to:
  `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🎨 Asset Maintenance (Launcher Icons)

If you change the branding/logo (`icon.png` in the root folder) and want to generate all Android mipmap sizes:

1. **Install `@capacitor/assets`** (if not already installed):
   ```bash
   npm install -D @capacitor/assets
   ```
2. **Place your new square icon** (`1024x1024` PNG) in the project root named as `icon.png`.
3. **Run the generator:**
   ```bash
   npx capacitor-assets generate --android
   ```

---

## 🚀 Preparing for a Production Release

When you are ready to ship a release build to the Google Play Store:

1. **Update App versioning in `android/app/build.gradle`:**
   * Increment the `versionCode` by 1.
   * Update the `versionName` (e.g. `"1.0.1"`).
2. **Generate Signed App Bundle (`.aab`):**
   * Open Android Studio via `npx cap open android`.
   * Go to **Build > Generate Signed Bundle / APK...**
   * Select **Android App Bundle**, choose/create your release Keystore, and build under the `release` flavor.
   * Upload the resulting `.aab` file from `android/app/release/app-release.aab` to your Google Play Console!
