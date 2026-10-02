// lib/auth-edge.ts - Edge & Cloudflare Native OAuth & Session Manager
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export const ALLOWED_TEACHER_EMAIL = process.env.ALLOWED_TEACHER_EMAIL || "maccarnic@gmail.com";
export const COOKIE_NAME = "science_teacher_session";

export interface TeacherSession {
  email: string;
  name: string;
  image?: string;
  exp: number;
}

// Simple signed HMAC session token compatible with Web Crypto API (supported natively in Cloudflare Workers)
async function getCryptoKey(secret: string) {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret || "default-secret-change-in-prod-12345"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(payload: { email: string; name: string; image?: string }, secret: string): Promise<string> {
  const key = await getCryptoKey(secret);
  const data: TeacherSession = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
  };
  const enc = new TextEncoder();
  const jsonStr = JSON.stringify(data);
  const base64Payload = btoa(unescape(encodeURIComponent(jsonStr)));
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(base64Payload));
  const sigBytes = Array.from(new Uint8Array(signatureBuffer));
  const signature = btoa(String.fromCharCode.apply(null, sigBytes));
  return `${base64Payload}.${signature}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<TeacherSession | null> {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;

    const key = await getCryptoKey(secret);
    const enc = new TextEncoder();
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payloadB64));
    if (!isValid) return null;

    const jsonStr = decodeURIComponent(escape(atob(payloadB64)));
    const session: TeacherSession = JSON.parse(jsonStr);

    if (session.exp && session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (session.email !== ALLOWED_TEACHER_EMAIL) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getTeacherSession(req?: NextRequest): Promise<TeacherSession | null> {
  const secret = process.env.NEXTAUTH_SECRET || "science-exam-secret";
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value;
  } else {
    try {
      const cookieStore = cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch {
      return null;
    }
  }

  if (!token) return null;
  return await verifySessionToken(token, secret);
}
