# 🤖 AI Agent Guide: PodLearn Development Workflow

Welcome, fellow Agent. To maintain the high-fidelity and stability of the PodLearn ecosystem, please adhere to these specialized development rules.

## 🏗️ Architecture: Hybrid SPA
PodLearn uses a **Modular Monolith** (Flask) that serves a **React Vite SPA**.

- **Source Code**: Located in `/frontend/src/`.
- **Static Assets**: Flask serves the "Built" version from `/app/static/dist/`.
- **Template Entry**: `/app/templates/app_modern.html`.

> [!IMPORTANT]
> **THE "BUILD" RULE**: 
> Every time you modify files in the `frontend/` directory, you **MUST** run the build command to update the files used by the Flask backend:
> ```bash
> cd frontend
> npm run build
> ```
> Failure to do this will result in the user seeing an "old" version of the app when visiting via the Flask server (Port 5020).

## 🎛️ State Management (Zustand)
We use two primary stores:
1.  **`useAppStore`**: Global dashboard state (Lessons, Playlists, Stats, Notifications).
2.  **`usePlayerStore`**: Video player logic, subtitles, and navigation.

### ⚠️ Known Gotchas: YouTube Poller Sync
The YouTube API polling interval (often 100ms) can sometimes conflict with `requestSeek` calls. 
- **The Bug**: After a seek, the poller might report the *old* time for a split second, causing the store to jump back (regression).
- **The Fix**: We use a `1000ms` buffer (`lastSeekTime`) and an `isSeeking` lock in `usePlayerStore.ts`. 
- **Guideline**: Do NOT decrease this buffer below 500ms.

## 📁 Key Directories
- `app/services/`: Core business logic (NLP, Subtitles, YouTube).
- `app/models/`: Database schema (SQLAlchemy).
- `frontend/src/components/player/`: The Shadowing Studio UI.
- `frontend/src/components/dashboard/`: Library and Set management.

## 🧪 Verification Checklist
Before finishing a task:
1. [ ] Run `npm run build` in `frontend/`.
2. [ ] Check for TypeScript errors (`tsc -b`).
3. [ ] Verify that UI changes are visible on the Flask port.
4. [ ] Ensure navigation logic (Next/Back Sentence) remains smooth.
