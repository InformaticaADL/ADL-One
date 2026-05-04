# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo with two independent projects:

- `frontend-adlone/` — React 19 + Vite + TypeScript SPA
- `api-backend-adlone/` — Node.js + Express REST API (ESM modules)

Both share a SQL Server database (`ADL_ONE_DB`).

---

## Commands

### Frontend (`frontend-adlone/`)

```bash
npm run dev        # Start Vite dev server
npm run build      # Type-check + production build (tsc -b && vite build)
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Backend (`api-backend-adlone/`)

```bash
npm run dev        # Start with nodemon (hot reload)
npm run start      # Start without hot reload
```

Backend requires a `.env` file — copy from `.env.example` and set `DB_PASSWORD` and `JWT_SECRET`.

Backend listens on port `4000` by default; frontend expects it at port `8002` (set via `VITE_API_URL` or hardcoded in `src/config/api.config.ts`).

---

## Architecture

### Frontend

**Navigation model** — There is no React Router. Navigation is entirely state-driven via `useNavStore` (Zustand, `src/store/navStore.ts`). `activeModule` and `activeSubmodule` determine what the `DashboardPage` renders. Switching views means calling `setActiveModule` / `setActiveSubmodule`, not navigating to a URL.

**Auth** — `AuthContext` (`src/contexts/AuthContext.tsx`) holds JWT token + user in state, persists to `localStorage` (remember me) or `sessionStorage` (default). It sets `axios.defaults.headers.common['Authorization']` globally and auto-logs out on 401/403. The `hasPermission(code)` helper checks the `permissions[]` array embedded in the user object; `AI_MA_ADMIN_ACCESO` is the super-admin bypass permission.

**HTTP client** — All feature services should import `apiClient` from `src/config/axios.config.ts` (Axios instance with request interceptor that auto-injects the token). The older `api.service.ts` (fetch-based) is a legacy utility; prefer `apiClient`.

**UI library** — Mantine v8 is the primary component library (`@mantine/core`, `@mantine/hooks`, `@mantine/form`, etc.). Tabler icons (`@tabler/icons-react`) are used throughout. Ant Design (`antd`) is also present but used sparingly.

**Feature modules** — Business logic lives under `src/features/`. Each domain (e.g., `medio-ambiente`, `admin`, `urs`, `chat`) has its own `pages/`, `components/`, and `services/` subdirectories. Feature services call `apiClient` directly and return typed data.

**Global state** — Zustand stores:
- `useNavStore` — navigation state (active module/submodule, deep-link IDs, fichas mode)
- `useNotificationStore` — real-time notifications; connects to Socket.IO on user login
- `useAuthStore` — not used; auth is managed via `AuthContext` instead
- `chatStore` — general chat state

### Backend

**Entry point** — `src/server.js` creates an Express app + `http.Server` + Socket.IO instance. `global.io` is the Socket.IO reference used across the codebase to emit events to connected clients.

**Routing pattern** — `routes/*.routes.js` → `controllers/*.controller.js` → `services/*.service.js`. Controllers call service methods and use `successResponse` / `errorResponse` from `src/utils/response.js` for consistent JSON shape: `{ success, message, data, timestamp }`.

**Auth chain** — `authenticate` middleware (JWT verify, attaches `req.user`) + `verifyPermission('PERM_CODE')` middleware (checks `req.user.permissions[]`). Routes requiring auth use both; admin routes often require specific permission codes.

**Database** — SQL Server via `mssql`. Connection pool is a singleton in `src/config/database.js` (`getConnection()`). Business logic calls stored procedures via `pool.request().execute('sp_name')`. The pool size is set to 5–25 connections.

**Real-time** — Socket.IO rooms follow the pattern `user_<userId>` (notifications) and `chat_<conversationId>` (general chat). Clients join rooms by emitting `join` / `joinChat` events after connecting.

**Scheduler** — `src/utils/scheduler.js` initializes a cron-like job runner at startup (`initScheduler()`). Background tasks (e.g., recurring notifications) are registered there.

**Response conventions** — Always use `successResponse(res, data, message)` or `errorResponse(res, message, statusCode)`. Paginated lists use `paginatedResponse(res, data, page, limit, total)`.
