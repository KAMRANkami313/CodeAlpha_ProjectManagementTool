# CollabTask

A real-time collaborative Kanban project management tool. Multiple users share workspaces, drag tasks across status columns, comment on tasks, and get live notifications — all over WebSockets.

> Built for the CodeAlpha internship program.

---

## ✨ Features

- **Auth** — JWT-based registration / login with rate-limited endpoints
- **Projects** — owned workspaces; invite members by email
- **Tasks** — title, description, status (Todo / In Progress / In Review / Done), priority (Low / Medium / High), assignee, due date
- **Kanban board** — drag-and-drop between status columns with optimistic UI + revert-on-failure
- **Comments** — per-task threaded discussion
- **Real-time** — Socket.io project rooms; instant task / comment / member / notification sync
- **Notifications** — in-app bell with unread badge; mark one / mark all read
- **Resilience** — graceful shutdown, reconnection banner, ErrorBoundary, request timeouts
- **Security** — Helmet, compression, CORS allowlist, input validation, bcrypt password hashing
- **Observability** — structured JSON logging (pino), per-request correlation IDs, redaction of secrets

---

## 🧱 Tech Stack

| Layer    | Tech                                                             |
| -------- | ---------------------------------------------------------------- |
| Backend  | Node.js, Express 5, Mongoose 9, Socket.io 4, JWT, bcryptjs, pino |
| Frontend | React 19, Vite 8, React Router 7, Socket.io-client, lucide-react |
| Database | MongoDB                                                          |
| Styling  | Vanilla CSS with CSS variables                                   |

---

## 📁 Project Structure

```
CodeAlpha_ProjectManagementTool/
├── backend/
│   ├── config/         env.js, db.js
│   ├── controllers/    userController, projectController, taskController, notificationController
│   ├── middleware/     authMiddleware, validate, errorMiddleware, requestId, httpLogger
│   ├── models/         User, Project, Task, Comment, Notification
│   ├── routes/         userRoutes, projectRoutes, taskRoutes, notificationRoutes
│   ├── services/       notificationService, realtimeService
│   ├── socket/         socketManager
│   ├── utils/          AppError, asyncHandler, generateToken, withTransaction, pagination, idHelpers, logger
│   ├── validators/     rules.js
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── context/    AuthContext, SocketContext, NotificationContext
│   │   ├── hooks/      useModal, useProjectRoom
│   │   ├── services/   api.js, socket.js
│   │   ├── components/ TaskCard, TaskColumn, TaskModal, CreateProjectModal,
│   │   │               MembersModal, NotificationBell, TaskCommentsModal,
│   │   │               ReconnectionBanner, ErrorBoundary, PageLoader
│   │   ├── pages/      Login, Signup, Dashboard, Board
│   │   ├── styles/     variables, global, auth, dashboard, board, notifications, animations
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── vite.config.js
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB 6+ (local or Atlas)

### 1. Backend

```bash
cd backend
cp .env.example .env       # then edit .env with your real values
npm install
npm run dev                # starts on http://localhost:5000
```

**Required env vars** (validated at startup — app exits if missing):

- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — long random string for signing tokens
- `CLIENT_URL` — frontend origin for CORS

### 2. Frontend

```bash
cd frontend
cp .env.example .env       # defaults usually fine for local dev
npm install
npm run dev                # starts on http://localhost:5173
```

---

## 🔌 API Endpoints

### Auth

| Method | Route                | Description              | Auth |
| ------ | -------------------- | ------------------------ | ---- |
| POST   | `/api/users`         | Register a new user      | ❌   |
| POST   | `/api/users/login`   | Login                    | ❌   |
| GET    | `/api/users/profile` | Get current user profile | ✅   |
| GET    | `/api/users/search`  | Search users by email    | ✅   |

### Projects

| Method | Route                               | Description            | Auth |
| ------ | ----------------------------------- | ---------------------- | ---- |
| POST   | `/api/projects`                     | Create project         | ✅   |
| GET    | `/api/projects`                     | List my projects       | ✅   |
| GET    | `/api/projects/:id`                 | Get project by ID      | ✅   |
| PUT    | `/api/projects/:id`                 | Update project (owner) | ✅   |
| DELETE | `/api/projects/:id`                 | Delete project (owner) | ✅   |
| POST   | `/api/projects/:id/members`         | Add member by email    | ✅   |
| DELETE | `/api/projects/:id/members/:userId` | Remove member          | ✅   |

### Tasks

| Method | Route                           | Description            | Auth |
| ------ | ------------------------------- | ---------------------- | ---- |
| POST   | `/api/tasks`                    | Create task            | ✅   |
| GET    | `/api/tasks/project/:projectId` | List tasks for project | ✅   |
| GET    | `/api/tasks/:id`                | Get task by ID         | ✅   |
| PUT    | `/api/tasks/:id`                | Update task            | ✅   |
| DELETE | `/api/tasks/:id`                | Delete task            | ✅   |
| POST   | `/api/tasks/:id/comments`       | Add comment            | ✅   |
| GET    | `/api/tasks/:id/comments`       | List comments for task | ✅   |

### Notifications

| Method | Route                         | Description           | Auth |
| ------ | ----------------------------- | --------------------- | ---- |
| GET    | `/api/notifications`          | List my notifications | ✅   |
| PUT    | `/api/notifications/:id/read` | Mark one as read      | ✅   |
| PUT    | `/api/notifications/read-all` | Mark all as read      | ✅   |

### System

| Method | Route     | Description           |
| ------ | --------- | --------------------- |
| GET    | `/health` | Health check + uptime |

---

## 🧭 Architecture Principles

- **Single Responsibility** — controllers orchestrate, services contain business logic, utils are pure functions, models define data shape only.
- **Fail-fast on config** — `config/env.js` validates required env vars at boot.
- **Operational errors via `AppError`** — every expected error (`404`, `403`, `400`) is thrown as `AppError(message, statusCode)`. Programmer errors propagate with full stack.
- **One ObjectId comparison helper** — `idHelpers.js` centralizes correct `ObjectId` equality (avoids the `===` bug).
- **Transactions where it matters** — cascading deletes (project → tasks → comments) run inside `withTransaction`.
- **Realtime via service, not raw socket** — `realtimeService.broadcastToProject()` and `notificationService.notifyUser()` are the only sanctioned ways to emit. Controllers never touch `io` directly.

---

## 🔭 Observability

- **Structured logs** — JSON in production, pretty-printed in development (`pino-pretty`).
- **Request IDs** — every request gets a UUID v4 (or reuses `X-Request-Id` from client); echoed in the `X-Request-Id` response header and in every log line.
- **Secret redaction** — `password`, `token`, `authorization` headers, `mongoUri`, and `jwtSecret` are redacted from logs automatically.
- **Log levels** — `LOG_LEVEL=debug|info|warn|error|fatal` (default `debug` in dev, `info` in prod).

---

## 🛡️ Security

- Passwords hashed with bcrypt (12 salt rounds), never selected from DB by default
- JWT auth on every protected route + Socket.io handshake
- Rate limiting: 10 logins / 15 min per identity, 5 registrations / hour
- Helmet security headers, gzip compression
- CORS allowlist to `CLIENT_URL`
- Input validation via `express-validator` on every mutating route
