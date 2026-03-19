# ⚡ WhisperVault — Whisper-Sync & Group Vaults Edition

A full-stack ephemeral secret-sharing platform with **AES-256-GCM encryption**, **self-destructing messages**, and — in this edition — **real-time encrypted group vault rooms** with a guaranteed zero-trace exit.

---

## 🏗 Architecture Overview

```
Frontend (React + Vite)          Backend (Spring Boot 3.2)
━━━━━━━━━━━━━━━━━━━━━━━          ━━━━━━━━━━━━━━━━━━━━━━━━━
Dashboard (secrets)              REST API (/api/*)
Inbox / Sent                     WebSocket (STOMP / SockJS)
Vault Rooms List           ←──►  GroupRoomController
GroupVault (live chat)           ChatController (pass-through)
                                 RoomStore (ConcurrentHashMap)
                                 WipeRoomService (Omni-Burn)
                                 EmailService (SMTP invites)
                                 MongoDB Atlas (metadata only)
                                 Redis (optional pub/sub)
```

---

## 🆕 Add-On Features: Whisper-Sync & Group Vaults

### 1. Unified Discovery & Handshaking
- **Multi-Mode Secure Entry** — Santhya's debounced search lets you find registered users by username or display name.
- Select one or more targets → the UI prompts: **"Send a Secret Message"** or **"Initiate Secret Chat Room"**.
- Group Chat Handshake: selecting multiple users creates a `PendingSession` UUID room. The room activates once any invitee accepts via email verification.

### 2. SMTP-Linked Intent Verification
- When a chat room is initiated, each invitee receives an **automated email** via JavaMailSender.
- The email contains a **hashed invite token** link that resolves to `/api/rooms/verify/{token}`.
- **Security Hook**: The backend verifies the token → redirects to a JWT-gated frontend page. The WebSocket handshake only completes after a valid authenticated session is confirmed.
- Token expiry: 30 minutes (configurable).

### 3. Volatile Group Rooms — Multi-User Real-Time Ephemeral Chat
- **STOMP over SockJS** at `/ws` with JWT authentication on CONNECT.
- Broadcasts on `/topic/chat/{roomUUID}`.
- **Encrypted File Tunnels**: Files up to 5 MB are AES-256-GCM encrypted in the browser, converted to Base64, and transmitted as a message payload. The backend is a **pure pass-through** — file bytes never touch disk or any server store.
- **Memory-Only Buffering**: `RoomStore` (ConcurrentHashMap) holds the last 50 messages per room in JVM heap only.

### 4. The Omni-Burn — Zero-Trace Exit
- Backend monitors subscriber count per room via Spring WebSocket lifecycle events (`@EventListener`).
- When subscriber count hits **zero** (all users disconnected), `WipeRoomService` is triggered automatically.
- **Physical Memory Flush**: `RoomStore.wipeRoom()` deletes all message buffers and subscriber state.
- **Final Audit** (Vaijayanthi's module): Logs `Session [UUID] ended at [Time]. Duration: Xm Ys. Content Purged: YES`.
- MongoDB room document is marked `BURNED` — only metadata, never chat content.

---

## 🚀 Getting Started

### Prerequisites
- Java 17+, Maven 3.8+
- Node 18+, npm 9+
- MongoDB Atlas URI
- Redis (optional — in-memory fallback works without it)
- SMTP credentials (optional — email features gracefully skip if not configured)

### Environment Variables
Create a `.env` file (for Docker) or export:
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
AES_SECRET_KEY=your-aes-key
EMAIL_USERNAME=your@gmail.com
EMAIL_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:5173
REDIS_HOST=localhost       # optional
REDIS_PASSWORD=            # optional
```

### Run with Docker Compose
```bash
docker-compose up --build
```

### Run Locally
```bash
# Backend
cd backend && mvn spring-boot:run

# Frontend
cd frontend && npm install && npm run dev
```

### Frontend Install (includes new WS dependencies)
```bash
cd frontend
npm install
# @stomp/stompjs and sockjs-client are included in package.json
```

---

## 📡 New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/rooms` | Create a group vault room + send email invites |
| `GET`  | `/api/rooms` | List pending/active rooms for current user |
| `GET`  | `/api/rooms/{id}` | Get room details |
| `POST` | `/api/rooms/{id}/join` | Join room (JWT authenticated) |
| `GET`  | `/api/rooms/verify/{token}` | Email verification link (public) |

### WebSocket Topics
| Destination | Direction | Description |
|-------------|-----------|-------------|
| `/ws` (SockJS) | Connect | STOMP endpoint — JWT in `Authorization` header |
| `/app/chat/{roomId}` | Send | Publish an encrypted message |
| `/topic/chat/{roomId}` | Subscribe | Receive all room messages |
| `/user/queue/history/{roomId}` | Subscribe | Receive message history on join |

---

## 🔒 Security Architecture

```
Client A                    Backend                    Client B
  │                           │                           │
  │── AES-256-GCM encrypt ──► │                           │
  │── STOMP /app/chat/{id} ──►│                           │
  │                           │── validate JWT ───────────│
  │                           │── verify room membership ─│
  │                           │── pass-through relay ─────►│
  │                           │                           │── AES-256-GCM decrypt
  │                           │                           │── display plaintext
  │                           │
  │                    [Never decrypts]
  │                    [Never stores to disk]
  │                    [ConcurrentHashMap only]
  │
  │ [All disconnect]
  │                           │
  │                    Omni-Burn triggered
  │                    wipeRoom() → ConcurrentHashMap.remove()
  │                    MongoDB room → status = BURNED
  │                    Audit log written
```

---

## 🏷 Tech Stack

**Backend**: Spring Boot 3.2 · Spring WebSocket (STOMP/SockJS) · Spring Security · JWT · AES-256-GCM · MongoDB (Atlas) · Redis (optional) · JavaMailSender · Lombok

**Frontend**: React 19 · Vite · @stomp/stompjs · sockjs-client · Web Crypto API · React Router v7 · React Hot Toast
