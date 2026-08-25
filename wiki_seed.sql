-- Seed: dokumentasi DevTrack di Wiki (idempoten â€” aman dijalankan ulang)
USE devtrack;

DELETE FROM wiki_notes WHERE created_by = 1 AND slug IN
('devtrack-overview','tech-stack','struktur-kode','cara-build-deploy','server-produksi','panduan-wiki');

INSERT INTO wiki_notes (project_id, title, slug, content, tags, created_by, tenant_id, created_at, updated_at) VALUES
(NULL, 'DevTrack Overview', 'devtrack-overview',
'# DevTrack Overview

**DevTrack** adalah platform manajemen proyek & IT support self-hosted: Kanban, timeline/Gantt, chat real-time, remote desktop, server monitoring, deploy pipeline, dan knowledge base (halaman ini) dalam satu aplikasi.

## Modul Utama
| Modul | Fungsi |
|---|---|
| Projects | Kanban board, timeline, kalender, laporan |
| Chat | Pesan pribadi/group, file, voice, call |
| IT Support | Inventory, purchase, password vault, IP |
| DevOps | Deploy, terminal, log viewer, server monitor |
| Remote Desktop | Kontrol mesin Windows via browser + agent C# |

## Dokumentasi Terkait
- Detail teknologi: [[Tech Stack]]
- Peta direktori kode: [[Struktur Kode]]
- Proses rilis aplikasi: [[Cara Build & Deploy]]
- Infrastruktur hosting: [[Server Produksi]]
- Cara memakai fitur wiki ini: [[Panduan Wiki]]

> Tip: awali halaman proyek/fitur baru dengan menautkannya dari halaman ini supaya mudah ditemukan lewat backlink.',
'dokumentasi, devtrack', 1, NULL, NOW(), NOW()),

(NULL, 'Tech Stack', 'tech-stack',
'# Tech Stack

## Frontend
- **Next.js 16** (Pages Router) + **React 19**, build dengan Turbopack
- **Tailwind CSS 3** â€” design token kustom di `tailwind.config.js` (warna `primary`, `surface`, animasi `fade-in-up`, `shadow-glow`, dll.)
- `@hello-pangea/dnd` untuk drag & drop Kanban
- `recharts` grafik dashboard, `gantt-task-react` timeline
- `react-markdown` + `remark-gfm` renderer markdown Wiki

## Backend
- API Routes Next.js (`pages/api/**`) di atas custom server **`server.js`** (Express-style + HTTPS)
- **MySQL** via `mysql2` pool â€” helper: `db.query`, `db.queryOne`, `db.insert`, `db.update` (`lib/db.js`)
- **Socket.IO** (+ msgpack parser) untuk chat, notifikasi, monitor
- Autentikasi JWT (`jsonwebtoken`) + bcrypt; CSRF token untuk semua endpoint mutasi (`lib/csrf.js`)
- Validasi input terpusat di `lib/middleware.js` (`validateData`)

## Infrastruktur
- Dijalankan **PM2** di [[Server Produksi]]
- Lihat [[Cara Build & Deploy]] untuk alur rilis.

Terhubung: [[DevTrack Overview]] Â· [[Struktur Kode]]',
'tech, dokumentasi', 1, NULL, NOW(), NOW()),

(NULL, 'Struktur Kode', 'struktur-kode',
'# Struktur Kode

```
devtrack/
â”œâ”€ pages/            # Route halaman + API
â”‚  â”œâ”€ api/           # Backend endpoints (auth, tasks, wiki, ...)
â”‚  â””â”€ dashboard/     # Halaman dalam app (projects, wiki, chat, ...)
â”œâ”€ components/
â”‚  â”œâ”€ layout/        # Sidebar, Header, Layout
â”‚  â”œâ”€ common/        # Modal, Toast, Badge, Loading, ...
â”‚  â””â”€ ...            # chat/, deploy/, remote/, dashboard widget
â”œâ”€ lib/              # Inti backend: db, auth, csrf, middleware,
â”‚                    # notifications, tenant, logger
â”œâ”€ hooks/            # useTenant, useWebRTC, usePushNotifications
â”œâ”€ styles/           # globals.css (design system)
â””â”€ scripts/          # deploy_sftp.cjs, ssh_run.cjs, syntax_check.cjs
```

## Konvensi Penting
- **API baru**: selalu `getAuthUser` â†’ validasi `validateData` â†’ `requireCSRF` untuk mutasi.
- **Tenant scoping**: gunakan pola `(tenant_id = ? OR tenant_id IS NULL)` agar catatan/data bersama tetap terlihat lintas workspace.
- **UI**: pakai class komponen global (`.btn-primary`, `.input-field`, `.card`, `.glass-panel`) sebelum menulis utility baru.

Terhubung: [[Tech Stack]] Â· [[DevTrack Overview]] Â· [[Cara Build & Deploy]]',
'kode, dokumentasi', 1, NULL, NOW(), NOW()),

(NULL, 'Cara Build & Deploy', 'cara-build-deploy',
'# Cara Build & Deploy

## Alur Standar (satu perintah)
```bash
node scripts/deploy_sftp.cjs
```
Yang dilakukan script:
1. Baca target dari `.vscode/sftp.json`
2. Upload daftar file pada konstanta `FILES` via SFTP
3. Hapus file usangan pada `REMOTE_DELETES` (jika ada)
4. **Build di server** (`npm run build`) â€” bukan di lokal
5. Restart service: `pm2 restart devtrack`

## Catatan Penting
- Edit konstanta `FILES` di `scripts/deploy_sftp.cjs` sesuai file yang berubah sebelum deploy.
- Opsi `--files-only`: upload tanpa build/restart.
- Helper lain: `node scripts/ssh_run.cjs "perintah"` untuk eksekusi command di server.
- Build lokal sering terblokir sandbox (`spawn EPERM`) â€” karena itu build selalu dilakukan di server.

## Checklist Sebelum Deploy
- [ ] Lolos `node scripts/syntax_check.cjs <file-yang-diubah>`
- [ ] Migrasi DB sudah dijalankan bila ada skema baru
- [ ] Verifikasi pasca-deploy via `curl -k https://127.0.0.1:3000/...` di [[Server Produksi]]

Terhubung: [[Server Produksi]] Â· [[Tech Stack]]',
'deploy, devops', 1, NULL, NOW(), NOW()),

(NULL, 'Server Produksi', 'server-produksi',
'# Server Produksi

| Item | Nilai |
|---|---|
| Host | `your-server-ip` |
| Aplikasi | HTTPS port **3000** (custom server + SSL) |
| Proses | PM2 app **devtrack** (cek `pm2 list`) |
| Direktori | `/var/www/devtrack` |
| Konfigurasi | `.env.local` (DB_*, JWT_*, SMTP_*, VAPID_*, dll.) |

## Hal yang Perlu Diingat
- Selalu akses via **https://** â€” HTTP akan gagal koneksi.
- Kredensial SFTP/SSH ada di `.vscode/sftp.json` (jangan di-commit ke repo publik).
- Log aplikasi: `node scripts/ssh_run.cjs "pm2 logs devtrack --lines 50 --nostream"`.
- Error `Unknown database` saat menjalankan fitur restore dengan nama database yang belum ada tidak berdampak ke operasional normal.

Terkait: [[Cara Build & Deploy]] Â· [[DevTrack Overview]]',
'server, infrastruktur', 1, NULL, NOW(), NOW()),

(NULL, 'Panduan Wiki', 'panduan-wiki',
'# Panduan Wiki

Knowledge base internal tim. Semua orang bisa membaca & menulis; edit/hapus dibatasi penulis catatan atau admin.

## Menulis Catatan
1. Klik **Catatan Baru** di panel kiri
2. Isi judul, tag (pisahkan dengan koma), opsional pilih proyek
3. Panel kanan = preview langsung

## Fitur Khas
- **Wikilink**: ketik `[[Judul Catatan]]` untuk menautkan. Link merah putus-putus = catatan belum ada; diklik akan membuatnya.
- **Backlinks**: bagian *Ditautkan dari* di bawah setiap catatan menampilkan semua rujukan masuk.
- **Deep-link**: URL tiap catatan bisa dibagikan di chat, mis. `/dashboard/wiki?note=12`.
- **Tag**: klik chip `#tag` di sidebar untuk memfilter.

## Ide Konten Untuk Tim
- SOP onboarding member baru
- Notulen meeting mingguan (tag `#meeting`)
- Runbook insiden â†’ tautkan dari [[Server Produksi]]

Contoh mulai dari: [[DevTrack Overview]]',
'panduan, wiki', 1, NULL, NOW(), NOW());
