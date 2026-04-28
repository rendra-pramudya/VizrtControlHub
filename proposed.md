# VizrtControlHub — Rancangan Arsitektur

## Tujuan
Monitoring dan automation untuk komponen Vizrt, tetap bisa digunakan operator manual.
Interface berbasis Browser (HTML — Vue 3 + Vite).

---

## Komponen yang Dikendalikan

| Komponen           | Protokol       | Default Port |
|--------------------|----------------|--------------|
| Viz Engine         | TCP Socket     | 6100         |
| Pilot Data Server  | HTTP/REST      | 8177         |
| MSE                | AtomPub/XML    | 8580         |
| Graphics Hub       | HTTP           | 19398        |

---

## Fitur per Komponen

### Viz Engine
- Kirim single Vizrt command ke engine (support multiple engine)
- Terima feedback/response (polling)

### Pilot Data Server
- Baca daftar template
- Baca data element
- Ubah/update data element

### MSE (Media Sequencer Engine)
- Buat playlist
- Tambahkan data element ke playlist
- Trigger aksi: `take`, `read`, `cut`, `continue`, `cue`, `out`, `update`
- Live status playlist via WebSocket

### Graphics Hub
- Explore konten: Scene, Geometry, Font, Texture, Audio
- Extensible untuk kategori lain

---

## Alur Komunikasi

```
Browser (Vue 3)
    │
    │  REST API + WebSocket
    ▼
Node.js / Express  (server.js)
    ├── /api/engine/*  ──── TCP Socket + Polling ──►  Viz Engine A :6100
    │                                             ──►  Viz Engine B :6100
    ├── /api/pilot/*   ──── HTTP/REST ────────────►  Pilot Data Server :8177
    ├── /api/mse/*     ──── AtomPub/XML ──────────►  MSE :8580
    │        │
    │        └── WebSocket ──────────────────────►  Browser (live status)
    ├── /api/hub/*     ──── HTTP ────────────────►  Graphics Hub :19398
    └── /api/config/*  ──── baca/tulis config.js
```

---

## Struktur Folder

```
VizrtControlHub/
├── frontend/                  # Vue 3 + Vite
│   └── src/
│       ├── views/
│       │   ├── EngineView.vue
│       │   ├── PilotView.vue
│       │   ├── MseView.vue
│       │   ├── HubView.vue
│       │   └── SettingsView.vue
│       ├── components/
│       ├── stores/            # Pinia
│       ├── services/          # HTTP calls ke backend
│       └── router/
│
├── backend/
│   ├── routes/
│   │   ├── engine/
│   │   ├── pilot/
│   │   ├── mse/
│   │   └── hub/
│   ├── services/
│   ├── middleware/            # Auth (disiapkan, aktifkan nanti)
│   ├── websocket/             # WebSocket untuk MSE live
│   └── server.js
│
└── config.js                  # Konfigurasi koneksi (IP, port)
```

---

## Sistem Konfigurasi

- Semua IP & port disimpan di `config.js`
- Backend membaca `config.js` saat startup dan saat ada perubahan
- Frontend Settings page: `GET /api/config` dan `PUT /api/config`

---

## Autentikasi

- Disiapkan tapi belum diaktifkan
- Basis JWT token
- Role: `operator`, `admin` / `automation`
- Middleware di setiap route — bypass mode aktif untuk development

---

## State Management Frontend (Pinia Stores)

| Store            | Tanggung Jawab                                    |
|------------------|---------------------------------------------------|
| useEngineStore   | List engine, command history, polling feedback    |
| useMseStore      | Playlist state, live status via WebSocket         |
| usePilotStore    | Templates & data elements                        |
| useHubStore      | Hasil browse Graphics Hub                        |
| useConfigStore   | Pengaturan koneksi                               |
