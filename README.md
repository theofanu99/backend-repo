# CREATED BY

Theofanu Rinaldo Santoso

# TNWK IoT Backend

Backend API untuk sistem Early Warning System TNWK berbasis IoT. Backend ini menangani autentikasi admin, registrasi device, monitoring device, device history, laporan panic dari aplikasi warga, integrasi RabbitMQ, dan command speaker.

## Fitur Backend

- Login dan register admin
- Register device IoT
- Monitoring device panic button, speaker, dan camera
- Delete device
- Device history
- Filter history berdasarkan tipe device, tanggal, dan pencarian
- Camera snapshot history
- Detail snapshot per camera
- Panic button fisik melalui RabbitMQ
- Panic button digital dari aplikasi warga
- Pairing panic button dan speaker berdasarkan GUID yang sama
- Command speaker melalui RabbitMQ
- Penyimpanan data menggunakan MongoDB

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- RabbitMQ
- AMQPLIB
- JWT Authentication
- Nodemon
- PM2 untuk production

## Struktur Folder

```txt
backend/
├── middleware/
│   └── auth.js
├── models/
│   ├── devices.js
│   ├── deviceHistory.js
│   ├── report.js
│   ├── speakerCommand.js
│   └── user.js
├── routes/
│   ├── authRoutes.js
│   ├── deviceRoutes.js
│   ├── historyRoutes.js
│   ├── panicRoutes.js
│   ├── reportRoutes.js
│   └── speakerRoutes.js
├── rabbitmqConsumer.js
├── server.js
├── package.json
└── README.md
```

## Environment Variables

Buat file `.env` di root folder backend.

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/iot_dashboard
JWT_SECRET=your_jwt_secret

RABBITMQ_URL=amqp://USER:PASSWORD@HOST:5672/VHOST
RABBITMQ_EVENT_QUEUE=tnwk.iot.events
RABBITMQ_COMMAND_EXCHANGE=amq.topic
RABBITMQ_COMMAND_ROUTING_PREFIX=tnwk.commands.speaker
```

Catatan:

- Jangan push file `.env` ke GitHub.
- Pastikan `.env` sudah masuk `.gitignore`.
- Untuk production, gunakan MongoDB Atlas atau MongoDB server kampus.
- Untuk RabbitMQ, gunakan credential yang diberikan oleh server/kampus.

## Instalasi

```bash
npm install
```

## Menjalankan Backend

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Backend default berjalan di:

```txt
http://localhost:5000
```

Test API:

```txt
GET http://localhost:5000/api/test
```

Response:

```json
{
  "message": "API OK"
}
```

## Endpoint API

### Auth

```txt
POST /api/auth/register
POST /api/auth/login
```

### Devices

```txt
GET    /api/devices
POST   /api/devices
DELETE /api/devices/:id
POST   /api/devices/update
POST   /api/devices/panic
```

### History

```txt
GET /api/history
GET /api/history/camera/:guid
```

Contoh query filter:

```txt
/api/history?type=camera
/api/history?search=PB-003
/api/history?startDate=2026-06-01&endDate=2026-06-06
```

### Reports / Panic Digital Warga

```txt
POST /api/reports/app-trigger
```

Endpoint ini digunakan oleh aplikasi warga untuk memicu panic button digital berdasarkan lokasi pengguna. Backend akan mencari speaker terdekat, menyimpan laporan, menyimpan history, dan mengirim command speaker.

### Speaker

```txt
GET  /api/speaker
POST /api/speaker
```

## Format Payload RabbitMQ

Payload dari panic button fisik menggunakan format:

```txt
guidDevice#state
```

Keterangan:

```txt
guidDevice = GUID device
state      = status tombol
```

State:

```txt
0 = panic button ditekan
1 = panic button dilepas
```

Contoh payload:

```txt
PB-003#0
PB-003#1
```

## Alur Panic Button Fisik

```txt
Panic Button
↓
RabbitMQ
↓
Backend Consumer
↓
MongoDB Device History
↓
Dashboard Web
↓
Speaker Command
```

Jika payload masuk:

```txt
PB-003#0
```

Backend akan:

```txt
1. Membaca payload dari RabbitMQ
2. Mencari panic button dengan GUID PB-003
3. Menyimpan history panic_triggered
4. Mencari speaker dengan GUID PB-003
5. Menyimpan history speaker_triggered
6. Mengirim command speaker PB-003#1 ke RabbitMQ
```

Jika payload masuk:

```txt
PB-003#1
```

Backend akan:

```txt
1. Menyimpan history panic_released
2. Mencari speaker dengan GUID PB-003
3. Menyimpan history speaker_stopped
4. Mengirim command speaker PB-003#0 ke RabbitMQ
```

## Pairing Panic Button dan Speaker

Sistem menggunakan pairing berdasarkan GUID yang sama dengan tipe device berbeda.

Contoh panic button:

```json
{
  "type": "panic_button",
  "guid": "PB-003",
  "name": "PANIC DEMO",
  "lat": -5.456419,
  "lng": 105.253735
}
```

Contoh speaker:

```json
{
  "type": "speaker",
  "guid": "PB-003",
  "name": "SPEAKER DEMO",
  "lat": -5.456419,
  "lng": 105.253735
}
```

Artinya:

```txt
PB-003 panic_button akan mengaktifkan PB-003 speaker
```

MongoDB tidak boleh memakai unique index hanya pada field `guid`. Yang benar adalah unique index kombinasi:

```js
deviceSchema.index({ guid: 1, type: 1 }, { unique: true });
```

Jika sebelumnya ada index lama:

```txt
guid_1
```

hapus dari MongoDB Compass:

```txt
iot_dashboard → devices → Indexes → Drop guid_1
```

Yang benar:

```txt
_id_
guid_1_type_1
```

## Device History

Collection `devicehistories` menyimpan event seperti:

```txt
registered
online
panic_triggered
panic_released
speaker_triggered
speaker_stopped
camera_snapshot
camera_active
```

Contoh history panic button:

```json
{
  "guid": "PB-003",
  "name": "PANIC DEMO",
  "type": "panic_button",
  "status": "panic_triggered",
  "source": "device"
}
```

Contoh history dari aplikasi warga:

```json
{
  "guid": "APP-PANIC",
  "name": "Panic dari Warga Demo",
  "type": "panic_button",
  "status": "panic_triggered",
  "source": "citizen_app",
  "reporterName": "Warga Demo",
  "description": "Panic digital dari aplikasi warga"
}
```

## Camera Snapshot

Database tidak menyimpan file gambar asli. Database hanya menyimpan link gambar melalui field:

```txt
imageUrl
```

Contoh:

```json
{
  "guid": "CAM-001",
  "name": "Camera Pos 1",
  "type": "camera",
  "status": "camera_snapshot",
  "imageUrl": "https://example.com/image.jpg"
}
```

Detail snapshot camera dapat diakses melalui:

```txt
GET /api/history/camera/CAM-001
```

## Panic Digital dari Aplikasi Warga

Aplikasi warga dapat mengirim panic digital ke backend.

Endpoint:

```txt
POST /api/reports/app-trigger
```

Contoh body:

```json
{
  "latitude": -5.456419,
  "longitude": 105.253735,
  "locationName": "Lokasi Demo",
  "duration": 30
}
```

Alur:

```txt
Aplikasi Warga
↓
Backend API
↓
Cari speaker terdekat
↓
Simpan report
↓
Simpan device history
↓
Kirim speaker command
↓
Dashboard menampilkan history
```

## Test Manual RabbitMQ

Publish payload:

```txt
PB-003#0
```

Expected backend log:

```txt
RMQ RAW MESSAGE: PB-003#0
RMQ PARSED PAYLOAD
History saved: PB-003 - panic_triggered
SPEAKER COMMAND SENT
```

Publish release:

```txt
PB-003#1
```

Expected backend log:

```txt
History saved: PB-003 - panic_released
SPEAKER COMMAND SENT
```

## Test Manual API

Test devices:

```txt
GET http://localhost:5000/api/devices
```

Test history:

```txt
GET http://localhost:5000/api/history
```

Test panic digital warga:

```txt
POST http://localhost:5000/api/reports/app-trigger
```

Endpoint panic digital membutuhkan token login karena menggunakan middleware `protect`.

## Deployment

### Jalankan dengan PM2

Untuk hosting kampus atau server Linux:

```bash
npm install
npm install -g pm2
pm2 start server.js --name tnwk-backend
pm2 save
```

Cek log:

```bash
pm2 logs tnwk-backend
```

Expected log:

```txt
Server running on 5000
MongoDB Connected
RabbitMQ Connected
Listening queue: tnwk.iot.events
```

## Security Notes

- Jangan push `.env` ke GitHub.
- Jangan hardcode `RABBITMQ_URL`.
- Jika credential RabbitMQ pernah ter-push ke GitHub, ganti password RabbitMQ.
- Gunakan environment variables di hosting.
- Untuk production, gunakan HTTPS dan reverse proxy seperti Nginx.
- Gunakan JWT secret yang kuat.

## Demo Flow

Urutan demo backend:

```txt
1. Jalankan backend
2. Pastikan MongoDB connected
3. Pastikan RabbitMQ connected
4. Publish payload PB-003#0
5. Cek history panic_triggered
6. Cek history speaker_triggered
7. Publish payload PB-003#1
8. Cek history panic_released
9. Cek history speaker_stopped
10. Trigger panic digital dari aplikasi warga
11. Cek report dan history masuk
```

## Status Project

Backend sudah mendukung:

```txt
- Auth admin
- Device registration
- Delete device
- Device monitoring
- Device history
- Camera snapshot
- Panic button fisik via RabbitMQ
- Panic button digital dari aplikasi warga
- Speaker command
- Pairing panic button dan speaker berdasarkan GUID yang sama
```