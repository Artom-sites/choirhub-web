---
description: Full clean iOS build and deploy
---

# Full Clean iOS Build

Always perform a full clean build when deploying changes to iOS.

// turbo-all

1. Remove stale build artifacts:
```bash
rm -rf .next out
```

2. Build Next.js with Capacitor flag:
```bash
CAPACITOR=true npm run build
```

3. Sync web assets to iOS project:
```bash
npx cap sync ios
```

4. Build the iOS IPA:
```bash
npx cap build ios
```

5. Open Xcode to deploy to device:
```bash
npx cap open ios
```
