<p align="center">
  <img src="public/logo.png" alt="DevTrack Logo" width="120" />
</p>

<h1 align="center">DevTrack</h1>

<p align="center">
  <strong>Full-Stack Project Management & IT Support Platform</strong><br/>
  <em>Built with Next.js, React, MySQL, Socket.IO & Real-Time Collaboration</em>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a>
</p>

---

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql" alt="MySQL" />
  <img src="https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/C%23_Agent-Windows-239120?logo=csharp" alt="C#" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT" />
</p>

---

## 🌟 Overview

**DevTrack** is a comprehensive project management and IT support platform designed for modern development teams. It combines agile task management, real-time collaboration, remote desktop access, server monitoring, and AI-powered assistance — all in a single, self-hosted application.

Whether you're managing a small team or running an IT department, DevTrack provides the tools you need: Kanban boards, Gantt charts, calendars, chat, database management, terminal access, deploy pipelines, and remote desktop — with multi-tenant support and customizable branding.

---

## ✨ Features

### 📊 Project Management
- **Kanban Board** — Drag-and-drop task management with customizable columns (Todo → In Progress → Review → Done)
- **Timeline / Gantt Chart** — Visual project timeline with day, week, and month views
- **Calendar** — Monthly calendar view with task deadlines and milestones
- **Task Details** — Rich task cards with priority, labels, assignments, checklists, file attachments, and activity history
- **Task Templates** — Reusable task templates for common workflows
- **Drag & Drop** — Full drag-and-drop support powered by `@hello-pangea/dnd`

### 💬 Real-Time Communication
- **Private Chat** — 1-on-1 messaging with read receipts and typing indicators
- **Group Chat** — Create team channels with member management
- **File Sharing** — Send images, voice messages, and files directly in chat
- **Emoji Reactions** — React to messages with emojis
- **Typing Indicator** — See when someone is typing in real-time
- **Unread Badges** — Live notification badges on chat and header

### 🖥️ Remote Desktop (RDP)
- **Full Desktop Viewer** — View and control remote Windows machines from your browser
- **Keyboard & Mouse** — Full keyboard input, mouse click, scroll, and drag support
- **Clipboard Sync** — Copy/paste between browser and remote machine
- **Multi-Session** — Connect to multiple remote machines simultaneously
- **C# Windows Agent** — Lightweight .NET agent that captures the desktop and streams it via WebSocket

### 🗄️ Database Management
- **SQL Editor** — Write and execute SQL queries with syntax highlighting
- **Table Browser** — Browse, search, and filter database records
- **Schema Inspector** — View table structure, indexes, and relationships
- **Export** — Export query results to CSV/JSON
- **Query History** — Track all executed queries with timestamps

### 🖧 Server Monitoring
- **Real-Time Metrics** — CPU, RAM, disk usage with live charts (via Socket.IO)
- **Process Monitor** — View and manage running processes
- **Network Monitor** — Bandwidth and connection tracking
- **Web Terminal** — Full terminal access (SSH/WebSocket) with xterm.js

### 🚀 DevOps & Deployment
- **Deploy Pipeline** — Push-to-deploy with build status tracking
- **Deploy Logs** — Real-time build and deployment logs
- **Backup Manager** — Create and restore server backups
- **Environment Editor** — Manage `.env` files from the UI
- **Git Integration** — Webhook-driven commit linking to tasks

### 🔒 Security
- **JWT Authentication** — Secure token-based auth with bcrypt password hashing
- **CSRF Protection** — Token-based CSRF defense on all state-changing endpoints
- **Rate Limiting** — Per-IP rate limiting on API, chat, mouse, keyboard, and WebSocket
- **Security Logs** — Track all login attempts, failed auths, and suspicious activity
- **Role-Based Access** — Admin and member roles with permission scoping
- **IP Tracking** — Log and display last login IP and timestamps

### 📈 Reports & Analytics
- **Dashboard** — Overview of tasks, overdue items, team productivity
- **Reports** — Task completion rates, burndown charts, team performance
- **Activity Heatmap** — GitHub-style contribution heatmap per user
- **PDF Export** — Generate and download PDF reports

### 🎨 Multi-Tenant & Branding
- **Custom Branding** — Upload your own logo, set theme colors, customize app name
- **Tenant Management** — Create and manage multiple organizations
- **User Invitations** — Invite team members via email or link
- **Role Scoping** — Owner / Admin / Member / Viewer roles per tenant
- **Feature Toggles** — Enable or disable features per tenant

### 🤖 AI Assistant
- **Gemini Integration** — AI-powered chat assistant via Google Gemini
- **Groq Support** — Fast inference via Groq API
- **Context-Aware** — AI understands your project context and codebase

### 📧 Notifications
- **Real-Time Push** — Browser push notifications via Web Push API
- **Email Notifications** — SMTP-based email notifications
- **Telegram Bot** — Optional Telegram notification integration
- **In-App Notifications** — Dropdown notification panel with unread count

### 🛠️ Additional Tools
- **IT Asset Tracking** — Track hardware, software, and licenses
- **IT Support Tickets** — Ticketing system for IT requests
- **Password Vault** — Encrypted password storage for IT team
- **IP Address Manager** — Track and document network infrastructure
- **Activity Logs** — Complete audit trail of all user actions
- **Team Management** — View team members, roles, and assignments

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, Next.js 16, Tailwind CSS 3 | UI framework, SSR, styling |
| **Charts** | Recharts 3 | Dashboard visualizations |
| **DnD** | @hello-pangea/dnd | Drag-and-drop for Kanban & Timeline |
| **Terminal** | xterm.js 6 | Web-based terminal emulator |
| **Real-Time** | Socket.IO 4.8 | WebSocket communication, live updates |
| **Backend** | Node.js (Next.js API Routes) | REST API + WebSocket server |
| **Database** | MySQL 8.0 (mysql2) | Persistent data storage |
| **Auth** | JWT (jsonwebtoken) + bcryptjs | Authentication & password hashing |
| **Remote Agent** | C# (.NET) | Windows desktop capture & control |
| **AI** | Google Gemini, Groq | AI assistant integration |
| **Notifications** | Web Push, Nodemailer, node-telegram-bot | Multi-channel notifications |
| **Process** | node-pty | Terminal process management |
| **SSH** | ssh2 | Remote server connections |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **MySQL** 8.0+
- **npm** or **yarn** or **pnpm**

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/devtrack.git
cd devtrack
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```env
# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=devtrack

# Authentication
JWT_SECRET=your-super-secret-random-key-here

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=http://localhost:3000

# Features (toggle on/off)
ENABLE_AI_ASSISTANT=true
ENABLE_DATABASE_MANAGER=true
ENABLE_SERVER_MONITOR=true
ENABLE_REMOTE_DESKTOP=false
```

### 3. Setup Database

Start the server and open the built-in setup wizard — it checks MySQL connectivity, creates the `devtrack` database, imports `schema.sql`, and optionally creates your admin account:

```bash
node server.js
```

Then open [http://localhost:3000/setup](http://localhost:3000/setup) and follow the steps.

> Prefer manual setup? Run `mysql -u root -p < schema.sql` instead.

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and login with:

| Email | Password | Role |
|-------|----------|------|
| `admin@devtrack.local` | `password` | Admin |

### 5. Start Custom Server (for WebSocket support)

```bash
node server.js
```

> The custom `server.js` enables Socket.IO for real-time features (chat, notifications, terminal, server monitoring).

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Dashboard │ │ Kanban   │ │   Chat   │ │ Terminal │  ...     │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       └────────────┴────────────┴────────────┘                  │
│                          │  HTTP / WS                           │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    Next.js Server                                │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────────┐        │
│  │  API Routes   │  │ Socket.IO  │  │   Custom Server  │        │
│  │  /api/*       │  │ Events     │  │   (server.js)    │        │
│  └──────┬───────┘  └─────┬──────┘  └──────────────────┘        │
│         │                │                                       │
│  ┌──────┴────────────────┴──────────────────────┐               │
│  │              MySQL Connection Pool            │               │
│  └──────────────────┬───────────────────────────┘               │
└─────────────────────┼───────────────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────────────┐
│                  MySQL Database                                  │
│  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐      │
│  │  users   │ │ projects │ │   tasks   │ │ notifications│ ...  │
│  └─────────┘ └──────────┘ └───────────┘ └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                      │
                      │ WebSocket
┌─────────────────────┼───────────────────────────────────────────┐
│              C# Windows Agent (Optional)                         │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────────┐         │
│  │Desktop Capture│ │ Input Relay │ │  Clipboard Sync  │         │
│  └──────────────┘ └─────────────┘ └──────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
devtrack/
├── 📄 server.js                 # Custom server (Socket.IO + API)
├── 📄 schema.sql                # Database schema & seed data
├── 📄 next.config.mjs           # Next.js configuration
├── 📄 tailwind.config.js        # Tailwind CSS config
│
├── 📂 pages/                    # Next.js pages (file-based routing)
│   ├── 📂 api/                  # Server-side API routes
│   │   ├── 📂 auth/             # Login, register, me, logout
│   │   ├── 📂 chat/             # Chat API (private + group)
│   │   ├── 📂 messages/         # Message history
│   │   ├── 📂 notifications/    # Notification CRUD
│   │   ├── 📂 tasks/            # Task CRUD + attachments
│   │   ├── 📂 projects/         # Project management
│   │   ├── 📂 tenant/           # Multi-tenant APIs
│   │   ├── 📂 upload/           # File upload handlers
│   │   └── 📂 ...               # 40+ API endpoints
│   │
│   └── 📂 dashboard/            # Dashboard pages
│       ├── index.js             # Main dashboard
│       ├── calendar.js          # Calendar view
│       ├── chat.js              # Real-time chat
│       ├── team.js              # Team management
│       ├── database.js          # Database manager
│       ├── terminal.js          # Web terminal
│       ├── server-monitor.js    # Server metrics
│       ├── remote.js            # Remote desktop
│       ├── deploy.js            # Deploy pipeline
│       ├── reports.js           # Analytics & reports
│       ├── security.js          # Security logs
│       └── 📂 projects/         # Project detail
│           ├── index.js         # Kanban board
│           └── timeline.js      # Gantt chart
│
├── 📂 components/               # React components
│   ├── 📂 layout/               # Header, Sidebar, Layout
│   ├── 📂 common/               # Loading, Modal, Buttons
│   ├── 📂 tasks/                # TaskCard, TaskModal
│   ├── 📂 remote/               # Remote desktop viewer
│   ├── 📂 dashboard/            # Dashboard widgets
│   ├── 📂 deploy/               # Deploy UI components
│   └── 📂 call/                 # Voice/video call UI
│
├── 📂 lib/                      # Server-side utilities
│   ├── db.js                    # MySQL connection & helpers
│   ├── auth.js                  # JWT token generation
│   ├── csrf.js                  # CSRF protection
│   ├── notifications.js         # Notification helpers
│   ├── logger.js                # Winston logger
│   └── dates.js                 # Date parsing utilities
│
├── 📂 hooks/                    # Custom React hooks
│   ├── useTenant.js             # Tenant context
│   └── useSocket.js             # Socket.IO hook
│
├── 📂 public/                   # Static assets
│   ├── favicon-white.webp       # App favicon
│   └── uploads/                 # User uploads
│
├── 📂 agent/                    # Remote Desktop Agent
│   └── 📂 devtrack-agent/       # C# Visual Studio project
│       ├── Agent.cs             # Main agent logic
│       └── DevTrackAgent.csproj # .NET project file
│
└── 📂 scripts/                  # Utility scripts & DB migrations
    ├── setup.sh                 # Server dependency installer
    └── *.sql                    # Schema migrations
```

---

## 🔧 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login with email & password |
| `POST` | `/api/auth/register` | Register new user |
| `GET` | `/api/auth/me` | Get current user info |
| `POST` | `/api/auth/logout` | Logout & clear session |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create new project |
| `GET` | `/api/projects/:id` | Get project details |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List tasks (filterable) |
| `POST` | `/api/tasks` | Create new task |
| `GET` | `/api/tasks/:id` | Get task details |
| `PUT` | `/api/tasks/:id` | Update task |
| `DELETE` | `/api/tasks/:id` | Delete task |
| `POST` | `/api/tasks/:id/attachments` | Upload attachment |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/chat` | List conversations |
| `POST` | `/api/chat` | Send private message |
| `GET` | `/api/chat/:userId` | Get chat history |
| `GET` | `/api/chat/groups` | List group chats |
| `POST` | `/api/chat/groups` | Create group chat |
| `POST` | `/api/chat/group/:groupId` | Send group message |

### WebSocket Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `chat:send` | Client → Server | Send private message |
| `chat:message` | Server → Client | Receive message |
| `chat:read` | Client → Server | Mark messages as read |
| `notification:new` | Server → Client | New notification received |
| `notification:unread-count` | Server → Client | Badge count update |
| `terminal:data` | Bidirectional | Terminal I/O |
| `remote:mouse` | Client → Server | Mouse input |
| `remote:keyboard` | Client → Server | Keyboard input |

> API documentation: see the route handlers in [`pages/api/`](pages/api/).

---

## 🔒 Security Features

| Feature | Implementation |
|---------|---------------|
| **Password Hashing** | bcrypt with salt rounds |
| **JWT Auth** | Stateless tokens with configurable expiry |
| **CSRF Protection** | Token-based validation on all mutating endpoints |
| **Rate Limiting** | Per-IP limits on API, chat, mouse, keyboard |
| **SQL Injection** | Parameterized queries + table name validation |
| **File Upload** | Type whitelist, size limits, path sanitization |
| **Input Validation** | Server-side validation on all inputs |
| **Security Logs** | Full audit trail of auth events & suspicious activity |

---

## 🌐 Multi-Tenant Support

DevTrack supports multi-tenant deployment where multiple organizations share a single instance:

- **Tenant Isolation** — Data scoped by `tenant_id` on all tables
- **Custom Branding** — Each tenant gets their own logo, colors, and app name
- **User Invitations** — Invite members via email with role-based access
- **Feature Toggles** — Enable/disable features per tenant
- **Subdomain Routing** — Access via `yourorg.devtrack.app`

---

## 🖥️ Remote Desktop Agent

The optional C# agent enables browser-based remote desktop access to Windows machines:

```bash
# Build the agent (requires .NET SDK)
cd agent/devtrack-agent
dotnet publish -c Release -r win-x64

# Run on Windows machine
DevTrackAgent.exe --server http://your-server:3000 --key your-api-key
```

**Capabilities:**
- Desktop capture at configurable FPS (up to 30)
- Mouse movement, click, scroll, drag
- Full keyboard input including shortcuts
- Clipboard text sync
- Screen resize adaptation
- Auto-reconnect on connection loss

---

## 📊 Database Schema

DevTrack uses MySQL with 20+ tables covering:

| Table Group | Tables |
|-------------|--------|
| **Core** | `users`, `projects`, `tasks`, `task_comments`, `task_commits`, `task_history` |
| **Chat** | `chat_groups`, `chat_group_members`, `message_reads`, `message_reactions` |
| **Notifications** | `notifications`, `push_subscriptions`, `notification_preferences` |
| **Security** | `security_logs`, `login_attempts`, `rate_limits`, `csrf_tokens`, `password_history` |
| **IT Management** | `it_assets`, `it_inventory`, `it_ip_addresses`, `it_password_vault`, `it_purchase_requests` |
| **DevOps** | `deployments`, `deploy_logs`, `deploy_backups`, `webhooks` |
| **Multi-Tenant** | `tenants`, `tenant_users`, `tenant_settings` |
| **Activity** | `activity_logs`, `file_activity_logs` |

Full schema available in [`schema.sql`](schema.sql).

---

## 🔐 SSO / OAuth Login

DevTrack supports "Sign in with" flows alongside password login. Providers are enabled automatically when their credentials are present in `.env.local` — no code changes needed.

| Provider | Env vars | Setup |
|----------|----------|-------|
| **Google** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth client ID (Web) |
| **GitHub** | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | [GitHub OAuth Apps](https://github.com/settings/developers) |
| **Any OIDC** (Azure AD/Entra ID, Keycloak, Authentik, ...) | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Point `OIDC_ISSUER` at your realm/tenant URL |

Set each provider's **callback URL** to `{NEXT_PUBLIC_APP_URL}/api/auth/oauth/{provider}/callback`.

Behavior:

- Accounts are auto-linked by **verified email** — logging in with Google/GitHub using the same email attaches the identity to the existing DevTrack account.
- New users get an account created automatically (role `member`).
- SSO accounts have no local password; password login is rejected with a hint to use the provider button.
- Anti-CSRF `state` (signed JWT, 10-minute TTL) protects the flow; sessions, security logs, and CSRF tokens work identically to password login.

---

## 🚢 Deployment

### Production Setup (Ubuntu + PM2)

```bash
# 1. Server setup
sudo apt update && sudo apt install -y nodejs npm mysql-server nginx

# 2. Clone and configure
git clone https://github.com/yourusername/devtrack.git
cd devtrack
cp .env.example .env.local
# Edit .env.local with production secrets

# 3. Install and build
npm install
npm run build

# 4. Setup database
mysql -u root -p < schema.sql

# 5. Start with PM2
pm2 start server.js --name devtrack
pm2 save
pm2 startup

# 6. Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/devtrack
```

<details>
<summary><strong>Nginx Config</strong></summary>

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

</details>

### SSL with Let's Encrypt

```bash
sudo certbot --nginx -d your-domain.com
```

---

## 🤝 Contributing

Contributions are welcome!

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code style (Prettier configured)
- Write meaningful commit messages
- Add descriptions to PRs
- Test your changes before submitting
- Update documentation if adding new features

---

## 📋 Roadmap

- [ ] **Docker** — One-click Docker Compose deployment
- [ ] **LDAP/OAuth** — Enterprise SSO integration
- [ ] **Mobile App** — React Native companion app
- [ ] **Webhooks** — Outbound webhook integrations (Slack, Discord, Teams)
- [ ] **Gantt Drag** — Interactive Gantt chart editing
- [ ] **Kanban Automation** — Auto-move cards based on triggers
- [ ] **Time Tracking** — Built-in Pomodoro timer and time logs
- [ ] **Custom Fields** — User-defined task fields
- [ ] **API v2** — RESTful API with OpenAPI/Swagger docs
- [ ] **Plugin System** — Extend DevTrack with custom plugins

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments- [Next.js](https://nextjs.org/) — The React framework
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [Socket.IO](https://socket.io/) — Real-time engine
- [Recharts](https://recharts.org/) — Chart library
- [xterm.js](https://xtermjs.org/) — Terminal emulator
- [Lucide](https://lucide.dev/) — Icon library
- [Hello Pangea](https://github.com/hello-pangea/dnd) — Drag and drop

---

<p align="center">
  Built with ❤️ by the DevTrack community<br/>
  <em>Star ⭐ this repo if you find it useful!</em>
</p>
