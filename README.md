# 🔬 Science Exam System
**ระบบสอบวิชาวิทยาศาสตร์ โรงเรียนบ้านกรวย**
URL: `https://science-exam.bankruaschool.ac.th`

---

## Tech Stack
- **Frontend/Backend**: Next.js 14 + TypeScript + Tailwind CSS
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (รูปภาพ)
- **Hosting**: Cloudflare Pages
- **Auth**: NextAuth.js + Google OAuth

---

## 🚀 Deploy Steps

### 1. ตั้งค่า Google OAuth
ไปที่ [console.cloud.google.com](https://console.cloud.google.com)
- สร้าง Project ชื่อ `science-exam`
- เปิด **Google+ API** และ **OAuth consent screen**
- สร้าง OAuth 2.0 Client ID

**Authorized JavaScript origins:**
```
https://science-exam.bankruaschool.ac.th
```
**Authorized redirect URIs:**
```
https://science-exam.bankruaschool.ac.th/api/auth/callback/google
```

### 2. ตั้งค่า Cloudflare

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

### 3. ตั้งค่า Environment Variables ใน Cloudflare Pages

```bash
# Secrets
npx wrangler pages secret put NEXTAUTH_SECRET
npx wrangler pages secret put GOOGLE_CLIENT_ID
npx wrangler pages secret put GOOGLE_CLIENT_SECRET
npx wrangler pages secret put R2_PUBLIC_URL
npx wrangler pages secret put ALLOWED_TEACHER_EMAIL
```

### 4. Deploy

```bash
npm run pages:build
npx wrangler pages deploy .vercel/output/static --project-name science-exam
```

### 5. Custom Domain
ใน Cloudflare Pages Dashboard → Custom domains → เพิ่ม `science-exam.bankruaschool.ac.th`
แล้วไปที่ DNS ของ domain เพิ่ม CNAME record ตามที่ Cloudflare บอก

---

## 💻 Local Development

```bash
# Copy env
cp .env.local.example .env.local
# แก้ไขค่าใน .env.local

# Install
npm install --legacy-peer-deps

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
