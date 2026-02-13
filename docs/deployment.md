# Deployment Guide

## 1. Web Deployment (Vercel)
The web version is automatically deployed to Vercel on every push to `main`.
- **Status**: ✅ Deployed
- **Commit**: `fix: remove list animations, fix page syntax, revert song list mobile view`

## 2. Firebase Configuration
Before building for native platforms, ensure the following configuration files are present:
- **Android**: `android/app/google-services.json` (✅ Present)
- **iOS**: `ios/App/App/GoogleService-Info.plist` (✅ Present)
  > [!IMPORTANT]
  > After adding `GoogleService-Info.plist` to the folder, you **must** manually add it to the Xcode project references:
  > 1. Right-click the **App** folder in Xcode.
  > 2. Select **Add Files to "App"...**
  > 3. Select `GoogleService-Info.plist`.
  > 4. Ensure "Add to targets: App" is checked.

## 3. iOS Deployment (Xcode)
To run the app on an iPad/iPhone:

1. **Verify Sync**:
   I have already run this for you:
   ```bash
   npm run build && npx cap sync ios
   ```

2. **Open Xcode**:
   Xcode should be open now. If not:
   ```bash
   npx cap open ios
   ```

3. **Configure & Run**:
   - In Xcode, select the **App** project in the left sidebar.
   - Go to **Signing & Capabilities**.
   - Select your **Team** (Add your Apple ID in Xcode Settings > Accounts if needed).
   - Connect your iPad via USB.
   - Select your iPad from the device dropdown menu at the top.
   - Click the **Play** (Run) button.

## 3. Android Deployment (APK)
- **Status**: ✅ APK Built Successfully!
- **Location**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Output Folder**: I have opened this folder for you in Finder.

To rebuild manually in the future using Terminal:
```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android && ./gradlew assembleDebug
```
