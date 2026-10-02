#!/bin/bash
# deploy.sh – Science Exam System Deploy Script
# รันใน Terminal: bash deploy.sh

set -e

echo ""
echo "🔬 Science Exam – Deploy to Cloudflare Pages"
echo "============================================="
echo ""

# ── Generate NEXTAUTH_SECRET อัตโนมัติ ─────────────────────────────
NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "✅ NEXTAUTH_SECRET generated automatically"

# ── รับ Google OAuth ───────────────────────────────────────────────
echo ""
echo "📋 กรุณากรอก Google OAuth Credentials"
echo "   (ไปสร้างที่ console.cloud.google.com → APIs & Services → Credentials)"
echo ""
read -p "   Google Client ID: " GOOGLE_CLIENT_ID
read -s -p "   Google Client Secret: " GOOGLE_CLIENT_SECRET
echo ""

# ── รับ R2 Public URL ──────────────────────────────────────────────
echo ""
echo "📦 กรุณากรอก R2 Public URL"
echo "   (Cloudflare Dashboard → R2 → science-exam-files → Settings → Public Access)"
echo "   ตัวอย่าง: https://pub-xxxxxxxx.r2.dev"
echo ""
read -p "   R2 Public URL: " R2_PUBLIC_URL

# ── Set Secrets ────────────────────────────────────────────────────
echo ""
echo "🔐 กำลังตั้งค่า Secrets ใน Cloudflare Pages..."

echo "$NEXTAUTH_SECRET"       | npx wrangler pages secret put NEXTAUTH_SECRET       --project-name science-exam
echo "$GOOGLE_CLIENT_ID"      | npx wrangler pages secret put GOOGLE_CLIENT_ID      --project-name science-exam
echo "$GOOGLE_CLIENT_SECRET"  | npx wrangler pages secret put GOOGLE_CLIENT_SECRET  --project-name science-exam
echo "$R2_PUBLIC_URL"         | npx wrangler pages secret put R2_PUBLIC_URL         --project-name science-exam
echo "maccarnic@gmail.com"    | npx wrangler pages secret put ALLOWED_TEACHER_EMAIL --project-name science-exam

echo ""
echo "✅ ตั้งค่า Secrets เสร็จแล้ว"

# ── Build ──────────────────────────────────────────────────────────
echo ""
echo "🏗️  กำลัง Build..."
npm run pages:build

# ── Deploy ─────────────────────────────────────────────────────────
echo ""
echo "🚀 กำลัง Deploy ขึ้น Cloudflare Pages..."
npx wrangler pages deploy .vercel/output/static --project-name science-exam

echo ""
echo "🎉 Deploy สำเร็จ!"
echo ""
echo "📌 ขั้นตอนสุดท้าย – Custom Domain:"
echo "   1. ไปที่ Cloudflare Pages Dashboard → science-exam → Custom domains"
echo "   2. เพิ่ม: science-exam.bankruaschool.ac.th"
echo "   3. เพิ่ม DNS CNAME ที่ Cloudflare บอกให้ชี้ไปที่ Pages"
echo ""
