# Choir Management Application

WebApp for managing choir repertoire, services, and digital sheet music distribution.

## 🚀 Key Features

- **Global Archive**: Searchable database of songs (Firebase Firestore).
- **Repertoire Management**: Per-choir song lists with status tracking.
- **Service Planning**: Create services (liturgies) and assign songs.
- **Digital Sheet Music**: Viewing PDFs directly in app (Cloudflare R2 + Firebase Storage).
- **Multi-part Support**: Management of separate parts (scores) for songs.
- **User Roles**: Regents (Admins) and Singers (Viewers).

## 🛠 Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **PDF Handling**: `react-pdf`, Cloudflare R2 Proxy

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd choir-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env.local` file with the following variables:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   
   # For PDF Proxy (Optional)
   R2_ENDPOINT=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

## 🧪 Testing

The project uses **Jest** and **React Testing Library** for unit and component testing.

Run tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## 🏗 Architecture

- **`app/`**: Next.js App Router pages and layouts.
- **`components/`**: Reusable React components.
  - `GlobalArchive.tsx`: Main song search interface.
  - `SongList.tsx`: Repertoire management.
  - `ServiceView.tsx`: Service planning UI.
- **`lib/`**: Utility functions and database wrappers.
  - `db.ts`: Firestore interactions.
  - `utils.ts`: Helper functions (formatters, etc).
  - `firebase.ts`: Firebase initialization.
- **`types/`**: TypeScript definitions.

## 🔄 Data Flow

1. **Global Archive**: Shared collection of songs (read-only for most users).
2. **Repertoire**: `choirs/{choirId}/songs`. References global songs or local uploads.
3. **Services**: `choirs/{choirId}/services`. Lists of song references for specific dates.

## 📝 License

Private.
