# VizrtControlHub — Guide Kerja di VS Code

Hasil analisa kode lokal (commit `a3d830a`). Dokumen ini berisi: gambaran proyek, cara setup & menjalankan di VS Code, peta kode, dan daftar perbaikan yang disarankan beserta urutannya.

---

## 1. Gambaran singkat

VizrtControlHub adalah **hub kontrol berbasis browser** untuk ekosistem Vizrt, plus **MCP server** supaya AI (Claude) bisa mengendalikan Vizrt langsung.

```
Browser (Vue 3 + Pinia, :5173)
   │  /api/*  dan  /ws/*   (di-proxy Vite)
   ▼
Backend Express (:3000)  ──┬── TCP :6100  ──► Viz Engine (1..n)
   │                       ├── HTTP :8177 ──► Pilot Data Server
   │                       ├── HTTP :8580 ──► MSE (AtomPub/XML)
   │                       ├── HTTP :19398 ─► Graphics Hub (basic auth)
   │                       ├── HTTP :21098 ─► Preview Server (snapshot PNG)
   │                       └── UDP  :7476  ◄── listener pesan masuk
   └── WebSocket /ws/mse  ──► browser (event MSE + UDP)

MCP server (mcp-server/server.js, stdio) ── langsung ke Engine/MSE/Pilot/Hub
                                            (TIDAK lewat backend)
```

Tiga bagian yang bisa dijalankan terpisah:

| Bagian | Folder | Stack | Entry | Jalankan |
|---|---|---|---|---|
| Backend | `backend/` | Node, Express 5, CommonJS | `server.js` | `npm run dev` (nodemon) |
| Frontend | `frontend/` | Vue 3, Vite 6, Pinia, ESM | `src/main.js` | `npm run dev` |
| MCP server | `mcp-server/` | Node, `@modelcontextprotocol/sdk`, CommonJS | `server.js` | dijalankan oleh klien MCP (stdio) |

Semua bagian membaca **satu file konfigurasi**: `config.js` di root.

> Catatan: di `mcp-server/` juga ada versi Python lama (`server.py`, `viz_engine_client.py`, 11 tool). Yang aktif menurut `.mcp.json` adalah **`server.js`** (35 tool). Anggap versi Python sebagai legacy.

---

## 2. Prasyarat

- Node.js 20+ (di mesin ini: v24.20.0)
- Python 3 hanya kalau ingin regenerate `viz_commands.json` / `viz_scripting.json` (di mesin ini: 3.14.7)
- Akses jaringan ke mesin Vizrt (Engine, MSE, Pilot, Hub)

### Extension VS Code yang disarankan

| Extension | Untuk |
|---|---|
| **Vue - Official** (`Vue.volar`) | file `.vue` |
| **ESLint** | lint JS |
| **REST Client** (`humao.rest-client`) | uji endpoint `/api/*` dari file `.http` |
| **XML** (`redhat.vscode-xml`) | membaca payload MSE/Pilot |
| **Python** | hanya kalau menyentuh parser di `mcp-server/` |

---

## 3. Setup pertama kali

1. **File → Open Folder…** → `C:\Users\rendra\Documents\GitHub\VizrtControlHub`
2. Double-click **`setup.bat`**. Batch ini:
   - mencari Node.js 20+ (juga di `C:\Program Files\nodejs` kalau belum ada di PATH; kalau belum terpasang sama sekali, menawarkan install lewat winget);
   - menjalankan `npm install` di `backend/`, `frontend/`, `mcp-server/` dan memastikan `nodemon` dan `vite` terpasang;
   - membuat `.env` dari `.env.example` kalau belum ada.
3. Isi `VIZ_HUB_PASSWORD` di **`.env`** (password Graphics Hub; file ini tidak ikut ke git).
4. Sesuaikan **`config.json`** (IP/port Engine, MSE, Pilot, Hub, previewServer), atau ubah lewat halaman Settings. `config.js` sekarang hanya loader: jangan diedit.
5. Jalankan: double-click `start.bat`, **atau** pakai Task VS Code di bawah. `start.bat` otomatis menjalankan `setup.bat` kalau dependency belum ada.

> Error "vite / nodemon is not recognized" = `node_modules` belum terpasang. Jalankan `setup.bat`.

### Konfigurasi & keamanan (setelah perbaikan P1)

| File | Isi | Ikut git? |
|---|---|---|
| `config.json` | host/port semua komponen, username Hub | ya |
| `.env` | `VIZ_HUB_PASSWORD`, opsional `HOST`, `PORT`, `CORS_ORIGINS` | **tidak** |
| `.env.example` | contoh isi `.env` | ya |

- Backend default hanya bisa diakses dari PC ini (`127.0.0.1`). Untuk membuka ke LAN, set `HOST=0.0.0.0` di `.env`, tetapi ingat API **tidak punya autentikasi**.
- `GET /api/config` tidak lagi mengirim password. Di Settings, kolom password dikosongkan saja kalau tidak ingin mengubahnya.
- `PUT /api/config` menolak config yang salah bentuk (HTTP 400 + daftar error).
- `/api/mse/element/content` hanya menerima `editUrl` ke host:port MSE yang ada di config.

Backend: <http://127.0.0.1:3000/api/health> — Frontend: <http://127.0.0.1:5173>

### 3a. Task VS Code (opsional, disarankan)

Buat `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "backend: dev",
      "type": "shell",
      "command": "npm run dev",
      "options": { "cwd": "${workspaceFolder}/backend" },
      "isBackground": true,
      "problemMatcher": []
    },
    {
      "label": "frontend: dev",
      "type": "shell",
      "command": "npm run dev",
      "options": { "cwd": "${workspaceFolder}/frontend" },
      "isBackground": true,
      "problemMatcher": []
    },
    {
      "label": "hub: dev (semua)",
      "dependsOn": ["backend: dev", "frontend: dev"],
      "problemMatcher": []
    }
  ]
}
```

Jalankan lewat **Terminal → Run Task… → hub: dev (semua)**.

### 3b. Debug backend dengan breakpoint

Buat `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug backend",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}/backend",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["nodemon", "--inspect", "server.js"],
      "restart": true,
      "console": "integratedTerminal"
    },
    {
      "name": "Debug frontend (Chrome)",
      "type": "chrome",
      "request": "launch",
      "url": "http://127.0.0.1:5173",
      "webRoot": "${workspaceFolder}/frontend/src"
    }
  ]
}
```

Matikan task `backend: dev` dulu sebelum debug, karena dua-duanya memakai port 3000.

---

## 4. Peta kode

### Backend (`backend/`)

| Route | File route → service | Fungsi |
|---|---|---|
| `GET /api/engine` | `routes/engine` → `config.js` | daftar engine |
| `POST /api/engine/:id/command` | `services/engineService.js` | kirim 1 command TCP (diakhiri `\0`), 1 koneksi per command |
| `GET /api/engine/:id/status` | `engineService.getStatus` | cek port terbuka |
| `GET /api/pilot/concepts`, `/templates`, `/data-elements…` | `services/pilotService.js` | baca Pilot Data Server (Atom XML → JSON) |
| `PUT /api/pilot/data-elements/:id` | `pilotService.updateDataElement` | ubah field, jaga `fo:wrapper` |
| `GET /api/pilot/data-elements/:id/payload-proxy` | `routes/pilot` | buang BOM/`fo:wrapper` agar MSE bisa membaca payload Pilot |
| `GET /api/mse/playlists`, `/elements`, `/profiles`, `/state` | `services/mseService.js` | baca MSE |
| `POST /api/mse/playlists/:sid/elements` | `mseService.addElementToPlaylist` | tambah scene Hub (coba `viz_scene`, fallback `viz-commands`) |
| `POST /api/mse/playlists/:sid/elements/move` | `mseService.moveElement` | reorder via PATCH `hierarchy_collection` |
| `POST /api/mse/profiles/:profile/:action` | `mseService.triggerProfileAction` | take/cue/out/continue/… (whitelist) |
| `GET /api/mse/preview` | `mseService.getPreviewImage` | PNG snapshot dari Preview Server |
| `GET /api/hub/*` | `services/hubService.js` | browse folder/file/thumbnail Graphics Hub |
| `GET/PUT /api/config` | `routes/config` | baca/tulis ulang `config.js` |
| `GET /api/udp/messages` + WS `/ws/mse` | `services/udpListener.js`, `websocket/mseSocket.js` | UDP :7476 → broadcast ke browser |

### Frontend (`frontend/src/`)

- `router/index.js`: 6 halaman — Engine, Pilot, MSE, Hub, Settings, UDP
- `services/api.js`: wrapper `fetch` ke `/api`
- `stores/use*Store.js`: satu store Pinia per komponen
- View terbesar: `MseView.vue` (679 baris) dan `HubView.vue` (620 baris). Kandidat utama untuk dipecah jadi `components/`, yang saat ini belum ada.

### MCP server (`mcp-server/server.js`)

35 tool, dikelompokkan:
- **MSE**: `mse_list_playlists`, `mse_list_elements`, `mse_add_hub_scene`, `mse_add_pilot_element`, `mse_add_scene_by_path`, `mse_delete_element`, `mse_move_element`, `mse_list_profiles`, `mse_get_profile_state`, `mse_trigger`, `mse_take_pilot_element`
- **Pilot**: `pilot_list_concepts`, `pilot_list_templates`, `pilot_search_templates`, `pilot_list_elements`, `pilot_get_element`, `pilot_update_element`, `pilot_create_element_from_template`, `pilot_render_to_engine`
- **Hub**: `hub_browse`, `hub_search`, `hub_get_file_info`, `hub_upload_image`, `hub_upload_archive`
- **Engine**: `engine_send`, `engine_list`, `viz_grab_frame`
- **Plugin/geometry**: `viz_plugin_list`, `viz_plugin_search`, `viz_plugin_get_params`, `viz_plugin_set_param`, `viz_plugin_apply_geom`, `viz_plugin_add_function`, `viz_geometry_info`, `viz_create_geometry`

Data pendukung: `viz_commands.json`, `viz_scripting.json`, `viz-plugin-registry.json` (dibuat dari `viz-cmd-doc-webhelp/` dan `viz-script-doc-webhelp/` lewat `parse_viz_*.py`).

---

## 5. Temuan — perlu diperbaiki (urut prioritas)

### 🔴 Prioritas 1: merusak setup atau keamanan

1. ✅ *Sudah diperbaiki.* **Path MCP server salah.** `.mcp.json` menunjuk `D:\rendra\Documents\GitHub\VizrtControlHub\mcp-server\server.js`, padahal repo ada di `C:\Users\rendra\Documents\GitHub\VizrtControlHub`. Akibatnya MCP `vizrt-control` gagal start. Perbaikan: ganti ke path relatif:
   ```json
   { "mcpServers": { "vizrt-control": { "command": "node", "args": ["mcp-server/server.js"] } } }
   ```
2. ✅ *Sudah diperbaiki.* **Password Hub ter-commit.** `config.js:30` (`Admin` / `VizDb`, default Vizrt). Selain itu `GET /api/config` mengirim password ini ke browser. Saran: pindahkan kredensial ke `.env` (sudah ada di `.gitignore`), dan sembunyikan `password` di respons `GET /api/config`.
3. ✅ *Sudah dimitigasi (bind 127.0.0.1 + CORS).* **Backend terbuka tanpa auth + CORS bebas** (`backend/server.js:16`). Siapa pun di LAN yang bisa mengakses port 3000 bisa `take`/`out` di MSE, menulis ulang `config.js`, dan mengirim command ke Engine. Minimal: bind ke `127.0.0.1`, atau aktifkan middleware auth yang sudah disiapkan.
4. ✅ *Sudah diperbaiki.* **`PUT /api/config` tanpa validasi** (`backend/routes/config/index.js:20`). Body apa saja ditulis menjadi `config.js`, lalu dieksekusi oleh `require`. Body yang salah bisa mematikan semua service. Saran: validasi struktur (engine[], pilot, mse, hub), dan simpan ke `config.json`, bukan file `.js`.
5. ✅ *Sudah diperbaiki.* **SSRF di `GET /api/mse/element/content?editUrl=`** (`backend/routes/mse/index.js:78`). Backend mau mengambil URL apa saja. Batasi agar `editUrl` harus diawali base URL MSE dari config.

### 🟠 Prioritas 2: bug fungsional

6. **URL proxy Pilot di-hardcode** `http://127.0.0.1:3000` (`backend/routes/pilot/index.js:74`). Kalau MSE ada di mesin lain, MSE akan mencari `127.0.0.1` miliknya sendiri. Akibatnya element Pilot gagal dimuat. Jadikan konfigurasi, misalnya `config.publicBaseUrl`.
7. **Scene path tidak di-escape di fallback viz-commands** (`backend/services/mseService.js:196`). Path yang mengandung `&` atau `<` akan merusak XML. Gunakan escape yang sama seperti cabang `viz_scene`. `vizLayer` juga sebaiknya di-whitelist (`MIDDLE`/`FRONT`/`BACK`).
8. **Setiap pesan UDP memicu fetch state MSE.** `udpListener.js:24` mem-broadcast ke `/ws/mse`, lalu `useMseStore.js:71` memanggil `fetchProfileState()` untuk setiap event. Kalau UDP ramai, MSE akan dibanjiri request. Saran: pisahkan channel UDP (misal `/ws/udp`) atau filter `type === "udp"`.
9. **UdpView melewati proxy Vite** (`frontend/src/views/UdpView.vue:52`, hardcode `:3000`). Ini tidak konsisten dengan `useMseStore`, yang memakai `location.host`, dan akan rusak setelah build/deploy. Pakai `ws://${location.host}/ws/mse`.
10. **Komentar API tidak sesuai kode** (`backend/routes/mse/index.js:89`). Komentar menyebut `direction: 'up'|'down'`, padahal kodenya memakai `toIndex`.
11. **MCP server membaca `config.js` sekali saja** (`mcp-server/server.js:10`). Perubahan dari halaman Settings baru berlaku setelah klien MCP di-restart.

### 🟡 Prioritas 3: kebersihan repo & struktur

12. File yang tidak seharusnya di-track: `.claude/settings.local.json`, `mcp-server/__pycache__/`. Tambahkan `__pycache__/`, `*.pyc`, dan `.claude/settings.local.json` ke `.gitignore`, lalu `git rm --cached`.
13. Logika duplikat antara `backend/services/*` dan `mcp-server/server.js` (helper TCP, parsing Atom, add element). Jangka menengah: buat folder `shared/` (misal `shared/vizClient.js`, `shared/mseClient.js`) yang dipakai backend dan MCP.
14. Engine: 1 koneksi TCP baru per command. Untuk polling sering, pertimbangkan koneksi persisten per engine dengan request-ID (`<id> COMMAND`) untuk mencocokkan respons.
15. Belum ada test dan lint. Mulai dari `npm i -D eslint` di backend dan unit test untuk parser XML (`pilotService`, `mseService`) memakai contoh XML di `mse_rest_api/mse_rest_example/*/TestResources/`.
16. `viz-cmd-doc-webhelp/` dan `viz-script-doc-webhelp/` berisi ±3.245 file dokumentasi Vizrt yang di-commit. Pertimbangkan dikeluarkan dari repo (cukup JSON hasil parse), apalagi jika repo akan dibagikan, karena dokumentasi tersebut milik Vizrt.

---

## 6. Alur kerja yang disarankan di VS Code

1. **Branch baru** untuk tiap kelompok perbaikan:
   ```powershell
   git checkout -b fix/setup-and-security
   ```
2. Kerjakan **Prioritas 1** dulu (nomor 1–5), satu commit per poin.
3. Uji tiap perubahan dengan **REST Client**. Buat `api.http` di root:
   ```http
   ### health
   GET http://127.0.0.1:3000/api/health

   ### engine list
   GET http://127.0.0.1:3000/api/engine

   ### kirim command ke engine
   POST http://127.0.0.1:3000/api/engine/engine-1/command
   Content-Type: application/json

   { "command": "0 RENDERER*TREE GET_EX 1 0 0 0" }

   ### playlist MSE
   GET http://127.0.0.1:3000/api/mse/playlists

   ### state profile
   GET http://127.0.0.1:3000/api/mse/profiles/default/state
   ```
   Klik **Send Request** di atas tiap blok.
4. Lanjut **Prioritas 2** (6–11), uji di UI (`:5173`) halaman MSE dan UDP.
5. **Prioritas 3** sebagai pekerjaan berkala.
6. Setelah `.mcp.json` diperbaiki, buka folder ini dengan Claude Code dan cek MCP `vizrt-control` muncul (35 tool).

### Checklist cepat

- [x] `npm install` di `backend/`, `frontend/`, `mcp-server/` (lewat `setup.bat`)
- [ ] `config.json` sesuai IP studio
- [x] `.mcp.json` path diperbaiki
- [x] Kredensial Hub pindah ke `.env` (password lama masih ada di riwayat git)
- [x] Backend default hanya `127.0.0.1` + CORS dibatasi (auth sungguhan belum ada)
- [x] Validasi `PUT /api/config`
- [x] Batasi `editUrl` ke host MSE
- [ ] `proxyBase` Pilot dari config
- [ ] Escape scene path + whitelist `vizLayer`
- [ ] Pisahkan event UDP dari event MSE
- [ ] UdpView pakai `location.host`
- [x] Bersihkan file yang ter-track (`__pycache__`, `settings.local.json`)
