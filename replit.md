# Beyond HOA – Homeowners Association App

## Overview
A full-featured mobile HOA management app built with Expo Router (React Native) and an Express backend. Provides owner and board dashboards, community voting, dues management, document library, announcements, and an AI-powered bylaw assistant.

## Architecture

### Frontend (Expo / React Native)
- **Framework**: Expo SDK 54 with Expo Router for file-based navigation
- **Auth**: JWT-based, token stored in `expo-secure-store`, managed by `contexts/AuthContext.tsx`
- **State**: AsyncStorage for local data persistence, React Query for API calls
- **Fonts**: Inter (400, 500, 600, 700) via @expo-google-fonts/inter
- **Icons**: @expo/vector-icons (Ionicons, MaterialCommunityIcons)
- **Animations**: react-native-reanimated for vote result bars
- **Keyboard**: react-native-keyboard-controller for AI chat input

### Backend (Express / TypeScript)
- **Server**: Express on port 5000
- **Database**: PostgreSQL (Replit built-in) accessed via `pg` pool in `server/db.ts`
- **AI**: OpenAI via Replit AI Integrations (no API key required)
- **Auth**: JWT (jsonwebtoken), passwords hashed with bcryptjs, `SESSION_SECRET` env var as JWT signing key
- **Routes**:
  - POST /api/auth/login – email + password → JWT token (30-day expiry)
  - GET /api/auth/me – verify JWT → resident profile
  - POST /api/auth/change-password – change own password (requires JWT)
  - POST /api/residents/:id/reset-password – board admin resets password (no auth required)
  - POST /api/bylaw-chat – streaming AI responses for bylaw questions
  - GET/POST /api/residents – list and create residents
  - PUT /api/residents/:id – update resident
  - DELETE /api/residents/:id – delete resident
  - POST /api/dues/checkout – create Stripe checkout session (requires STRIPE_SECRET_KEY env var)
  - GET /api/dues/payments – list all payment records from PostgreSQL
  - GET /api/dues/payment-status/:sessionId – verify a Stripe session and update DB
  - GET /api/dues/stripe-configured – returns whether Stripe secret key is set
  - GET /api/dues/payment-success – Stripe redirect handler (updates DB, serves branded HTML)
  - GET /api/dues/payment-cancelled – Stripe cancel redirect (serves branded HTML)

### AI Integration
- Uses Replit AI Integrations (OpenAI-compatible, billed to Replit credits)
- Model: gpt-5.1 for the bylaw assistant
- Streaming SSE responses for real-time chat experience
- HOA-specific system prompt with knowledge of CC&Rs, bylaws, procedures

## App Structure

```
app/
  _layout.tsx          # Root layout (fonts, QueryClient, KeyboardProvider)
  (tabs)/
    _layout.tsx        # Tab bar (NativeTabs liquid glass on iOS 26+)
    index.tsx          # Owner Dashboard + Announcements
    residents.tsx      # Residents directory (PostgreSQL-backed CRUD)
    voting.tsx         # Community voting with animated results
    dues.tsx           # HOA dues tracking and payment
    documents.tsx      # Document library with search/filter
    assistant.tsx      # AI Bylaw Assistant (streaming chat)
  board.tsx            # Board Dashboard (modal)
```

## Features
1. **Owner Dashboard** – Dues status, active votes summary, quick actions, pinned announcements
2. **Board Dashboard** – Stats panel, action items checklist, quick admin tools, board member directory
3. **Community Voting** – Active/closed ballots, animated vote bars, one-vote-per-user enforcement
4. **Dues Management** – Payment history, outstanding balances, pay-now flow
5. **Document Library** – Searchable/filterable HOA documents by category (bylaws, rules, minutes, financial, forms, legal)
6. **Announcements** – Pinned and chronological community notices with category indicators
7. **AI Bylaw Advisor** – Streaming conversational AI specialized in HOA rules and bylaws
8. **Residents Directory** – Searchable PostgreSQL-backed directory; add/edit/delete residents with name, unit, status (owner/tenant), email, phone, move-in date, and notes

## Color Theme
- Navy: #0F2340 (primary, headers, user chat bubbles)
- Gold: #C9A84C (accent, active tabs, highlights)
- Background: #F5F7FA
- Cards: #FFFFFF
- Success: #2ECC71, Warning: #F39C12, Danger: #E74C3C

## Key Dependencies
- expo-router, expo-glass-effect (liquid glass tabs)
- @tanstack/react-query, @react-native-async-storage/async-storage
- react-native-reanimated, react-native-keyboard-controller
- expo-haptics, expo-linear-gradient, expo-blur
- openai (via Replit AI Integrations env vars)

## Data Storage
- Announcements, votes, dues, and documents seeded on first launch via AsyncStorage
- AI conversation history maintained in component state (not persisted)
- **Residents**: PostgreSQL table `residents` — 12 seeded residents, full CRUD via REST API
  - Fields: id, name, unit, email, phone, status (owner/tenant), move_in_date, notes, created_at, password_hash
  - All residents have default password `Welcome1!` set on first server start
  - New residents created by board admin also get default password `Welcome1!`

## Running the App
- Backend: `npm run server:dev` (port 5000)
- Frontend: `npm run expo:dev` (port 8081)
- Scan QR code with Expo Go to test on device

## Deploying to Vercel
The Express server and Expo web build can be deployed together on Vercel as a full-stack app.

### Structure
- `server/app.ts` — exports `createApp()`, the shared Express app setup (routes, CORS, Stripe, static serving). Used by both the Replit entry point and the Vercel serverless function.
- `server/index.ts` — standalone entry point (Replit/local): calls `createApp()` then `.listen()`.
- `api/index.ts` — Vercel serverless function entry point; wraps the same `createApp()` Express app as a request handler (app instance is cached/reused across warm invocations).
- `vercel.json` — routes `/api/*` to the serverless function and serves the Expo web export (`dist/`) for everything else, with SPA fallback.
- `scripts/build-vercel.js` — Vercel build command (`npm run vercel:build`); runs `expo export --platform web` using Vercel's `VERCEL_URL`/`VERCEL_PROJECT_PRODUCTION_URL` to set `EXPO_PUBLIC_DOMAIN`.

### Required environment variables (set in Vercel Project Settings)
- `DATABASE_URL` — Postgres connection string (e.g. Neon, Supabase, or any Postgres provider). Replit's built-in database is not available outside Replit.
- `OPENAI_API_KEY` — standard OpenAI API key (replaces Replit AI Integrations, which only works inside Replit). The server checks `AI_INTEGRATIONS_OPENAI_API_KEY` first (for Replit), then falls back to `OPENAI_API_KEY`.
- `STRIPE_SECRET_KEY` — required for dues payment checkout.
- `SESSION_SECRET` — JWT signing key; use a long random string.

### Notes
- CORS is configured to allow Replit domains, localhost, and any `*.vercel.app` origin (plus `VERCEL_URL`/`VERCEL_PROJECT_PRODUCTION_URL`) automatically — no extra config needed for Vercel preview or production deployments.
- The Stripe webhook URL is auto-registered against whichever deployed domain is detected (Replit or Vercel) on server startup.
