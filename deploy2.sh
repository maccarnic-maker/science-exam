#!/bin/bash
# deploy2.sh – อ่านจากไฟล์ .secrets ไม่ต้องกรอกใน terminal

set -e

if [ ! -f .secrets ]; then
  echo "❌ ไม่พบไฟล์ .secrets กรุณาสร้างไฟล์ก่อน"
  exit 1
fi

source .secrets

if [[ "$GOOGLE_CLIENT_ID" == "ใส่ค่าที่นี่" ]] || [[ -z "$GOOGLE_CLIENT_ID" ]]; then
  echo "❌ กรุณากรอก GOOGLE_CLIENT_ID ในไฟล์ .secrets"; exit 1
fi
if [[ "$GOOGLE_CLIENT_SECRET" == "ใส่ค่าที่นี่" ]] || [[ -z "$GOOGLE_CLIENT_SECRET" ]]; then
  echo "❌ กรุณากรอก GOOGLE_CLIENT_SECRET ในไฟล์ .secrets"; exit 1
fi

echo "✅ อ่านค่าจาก .secrets สำเร็จ"

NEXTAUTH_SECRET=$(openssl rand -base64 32)
echo "✅ สร้าง NEXTAUTH_SECRET อัตโนมัติ"

echo ""
echo "🔐 กำลังตั้งค่า Secrets..."
echo "$NEXTAUTH_SECRET"     | npx wrangler pages secret put NEXTAUTH_SECRET       --project-name science-exam
echo "$GOOGLE_CLIENT_ID"    | npx wrangler pages secret put GOOGLE_CLIENT_ID      --project-name science-exam
echo "$GOOGLE_CLIENT_SECRET"| npx wrangler pages secret put GOOGLE_CLIENT_SECRET  --project-name science-exam
echo "maccarnic@gmail.com"  | npx wrangler pages secret put ALLOWED_TEACHER_EMAIL --project-name science-exam
echo "https://science-exam.bankruaschool.ac.th" | npx wrangler pages secret put NEXTAUTH_URL --project-name science-exam

echo "✅ Secrets ครบแล้ว"

echo ""
echo "🏗️  กำลัง Build..."
npm run pages:build

echo ""
echo "🚀 กำลัง Deploy..."
npx wrangler pages deploy .vercel/output/static --project-name science-exam

rm -f .secrets
echo "🔒 ลบ .secrets แล้ว"
echo ""
echo "🎉 Deploy สำเร็จ!"
echo "🌐 https://science-exam.bankruaschool.ac.th"
echo ""
echo "📌 ขั้นต่อไป: Custom Domain"
echo "   Cloudflare Pages → science-exam → Custom domains"
echo "   เพิ่ม: science-exam.bankruaschool.ac.th"
