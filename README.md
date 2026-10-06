# 📝 Online Exam System
**ระบบสอบออนไลน์ โรงเรียนบ้านครัว(ซิเมนต์ไทยสงเคราะห์)**
URL: `https://onlinetest.bankruaschool.ac.th`

> สาขานี้เตรียมย้ายไป Workers; production ยังเป็น Pages จนตั้งค่า Google Login
> และตรวจ cutover ครบ ดู [ขั้นตอนย้ายและ rollback](docs/workers-migration.md)

---

## Tech Stack
- **Frontend/Backend**: Next.js 15.5.27 + TypeScript + Tailwind CSS
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (รูปภาพ)
- **Hosting**: Cloudflare Workers + OpenNext (pending production cutover)
- **Auth**: Google OAuth + signed HMAC session cookie

---

## 🚀 Deploy Steps

### 1. ตั้งค่า Google OAuth
ไปที่ [console.cloud.google.com](https://console.cloud.google.com)
- สร้าง Project ชื่อ `science-exam`
- เปิด **Google+ API** และ **OAuth consent screen**
- สร้าง OAuth 2.0 Client ID

**Authorized JavaScript origins:**
```
https://onlinetest.bankruaschool.ac.th
```
**Authorized redirect URIs:**
```
https://onlinetest.bankruaschool.ac.th/api/auth/google
```

### 2. ตั้งค่า Cloudflare สำหรับระบบใหม่เท่านั้น

ระบบเดิมมี D1 และ R2 อยู่แล้ว ห้ามสร้างใหม่หรือรัน migrations ซ้ำระหว่างย้าย runtime

```bash
# Login Cloudflare
npx wrangler login

# สร้าง D1 Database
npx wrangler d1 create science-exam-db

# สร้าง R2 Bucket
npx wrangler r2 bucket create science-exam-files

# Run migrations
npx wrangler d1 migrations apply science-exam-db --remote
```

### 3. ตั้งค่า Environment Variables ใน Worker `science-exam`

```bash
# Secrets
npx wrangler secret put NEXTAUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put ALLOWED_TEACHER_EMAIL
```

### 4. Deploy

```bash
npm run deploy
```

### 5. Custom Domain
สำหรับการย้ายระบบเดิม ให้ทำตาม `docs/workers-migration.md` ก่อนสลับ route
และคง Pages เดิมไว้สำหรับ rollback ห้ามลบ DNS หรือ Pages ก่อนตรวจระบบใหม่ครบ

---

## 💻 Local Development

```bash
# Copy env
cp .env.local.example .env.local
# แก้ไขค่าใน .env.local

# Install
npm ci

# Run dev
npm run dev
```
เปิด http://localhost:3000

---

## 📁 โครงสร้างไฟล์
```
app/
├── login/                  # หน้า Login Google (ครู)
├── teacher/
│   ├── dashboard/          # แดชบอร์ดครู
│   └── exams/
│       ├── page.tsx        # รายการข้อสอบ
│       ├── new/            # สร้างข้อสอบใหม่
│       └── [id]/           # แก้ไข + QR Code + ผลสอบ
├── exam/
│   └── [id]/
│       ├── page.tsx        # นักเรียนลงทะเบียน
│       └── take/           # หน้าสอบ
└── api/                    # API Routes
    ├── auth/               # NextAuth
    ├── exams/              # CRUD ข้อสอบ
    ├── questions/          # CRUD ข้อ
    ├── classrooms/         # ดึงห้องเรียน
    ├── upload/             # อัปโหลดรูป R2
    ├── exam-info/          # Public: ข้อมูลข้อสอบ
    └── results/            # บันทึก/ดูผลสอบ
```
