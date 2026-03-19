
# 🔒 WhisperVault: Enterprise Ephemeral Messaging SaaS

**WhisperVault** is a secure, identity-first messaging platform designed for the safe sharing of sensitive information—passwords, API keys, and private files. Data is encrypted at rest and "self-destructs" immediately after being read. This project demonstrates a professional implementation of the full software development lifecycle, prioritizing **data ephemerality** and **cybersecurity best practices**.

### 📺 Project Walkthrough
[**▶️ Click here to watch the 5-Minute Technical Demo Video**](https://drive.google.com/file/d/15Hj9z7ZfD6RidN4YpWrVZt2QeDqiPci6/view?usp=sharing)

---

### 🌟 Core Philosophy
* **Identity-First:** Secrets are sent directly to specific registered users, ensuring only the intended recipient can access the data.
* **Zero-Knowledge Storage:** All sensitive data (Text and Files) is encrypted using **AES-256** before it ever reaches the database.
* **Atomic Destruction:** Records are purged from the database the millisecond they are successfully retrieved by the recipient.
* **Zero-Trace Chat:** "Whisper-Sync" chat rooms exist only in volatile server memory and are wiped instantly upon exit.
* **Automated Cleanup:** Unread secrets are automatically deleted after a 24-hour window via **MongoDB TTL** indexes.

### 🛠️ Tech Stack
* **Backend:** Java 17+, Spring Boot 3, Spring Security (JWT-based Auth).
* **Frontend:** React (Vite), Tailwind CSS v4, Material UI.
* **Database:** MongoDB Atlas (NoSQL).
* **Real-time:** WebSockets (STOMP/SockJS) for Whisper-Sync Chat.
* **Infrastructure:** Vercel (Frontend), Render/Railway (Backend).

### 🚀 Master Add-On Features (Whisper-Social)
* **Whisper-Sync Chat:** Real-time, memory-only chat sessions with **Emoji support** and **Voice Memos**.
* **Secure File Tunneling:** Encrypted sharing of documents and images (up to 5MB) with shared **Symmetric Previews** for both sender and receiver.
* **Biometric Identity:** Profile management featuring **Face-Scan Avatars** via live camera capture and secure password rotation logic.
* **Public Spectator Vaults:** Public-facing secure chats with a unique **"Request-to-Join" (Knock)** permission layer for live guest participation.
* **Verified Notifications:** SMTP-integrated email alerts for "New Secret Received" and "Chat Invitations" with secure verification links.
* **Context Protection:** Frontend "Tab-Blur" logic automatically hides sensitive content when the browser window loses focus.

### 📁 Project Structure
```text
whisper-vault/
├── backend/ (Spring Boot + Docker)
│   ├── src/main/java/com/vault/
│   │   ├── config/             # Security (JWT), Mongo (TTL) & WebSocket Configuration
│   │   ├── controller/         # REST & WebSocket Endpoints (Auth, Chat, Social)
│   │   ├── dto/                # Data Transfer Objects for clean API contracts
│   │   ├── model/              # Entities: User, Secret, ChatSession, ActivityLog
│   │   ├── service/            # Logic: AES-256, Audio Processing, Burn, and Email
│   │   └── security/           # JWT Filters and BCrypt Password Protection
│
├── frontend/ (React + Vite)
│   ├── src/
│   │   ├── api/                # axiosConfig.js (JWT Interceptors)
│   │   ├── components/         # ChatWindow, FaceCapture, EmojiPicker, SearchBar
│   │   ├── pages/              # Dashboard, SecretVault, Profile, VerifiedEntry
│   │   └── theme/              # Tailwind v4 and Material UI Customizations
```

### 👥 Team Responsibilities

| Member | Module | Key Responsibility |
| :--- | :--- | :--- |
| **Harshini** | Auth & Verification | JWT implementation, BCrypt hashing, and **SMTP Services**. |
| **Santhya** | Discovery & Profile | User Search API, **Face-Scan Integration**, and Emoji logic. |
| **Maheswari** | Encryption Engine | **AES-256 Service**, File Encryption, and Permission Gating. |
| **Naveneatha** | Burn & UI Logic | "Burn-on-Read" retrieval logic, **Symmetric Previews**, and Tab-Blur. |
| **Vaijayanthi** | Infrastructure | **WebSocket STOMP Broker**, Audio Streaming, and System Health. |

---
