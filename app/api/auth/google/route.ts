export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, COOKIE_NAME, ALLOWED_TEACHER_EMAIL } from "@/lib/auth-edge";
import { getDB } from "@/lib/cloudflare";

// Handler for Google OAuth sign-in redirect & callback
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const action = url.searchParams.get("action");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const nextAuthUrl = process.env.NEXTAUTH_URL || url.origin;
  const redirectUri = `${nextAuthUrl}/api/auth/google`;

  // 1. Sign out action
  if (action === "signout") {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  // 2. Initial login trigger -> Redirect to Google
  if (!code) {
    if (!clientId) {
      return NextResponse.json({ error: "Missing GOOGLE_CLIENT_ID" }, { status: 500 });
    }
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=openid%20email%20profile&prompt=select_account`;
    return NextResponse.redirect(googleAuthUrl);
  }

  // 3. Callback from Google with authorization code
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId || "",
        client_secret: clientSecret || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return NextResponse.redirect(new URL("/login?error=token_failed", req.url));
    }

    const tokenData = await tokenRes.json() as { access_token: string };

    // Fetch user profile
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(new URL("/login?error=user_failed", req.url));
    }

    const userData = await userRes.json() as { email: string; name: string; picture?: string };

    // Check teacher email authorization
    if (userData.email !== ALLOWED_TEACHER_EMAIL) {
      return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
    }

    // Save/update teacher in D1 database
    try {
      const db = getDB(req);
      if (db) {
        await db
          .prepare(
            "INSERT INTO teachers (id, email, name, image) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, image=excluded.image"
          )
          .bind(userData.email, userData.email, userData.name, userData.picture ?? null)
          .run();
      }
    } catch (dbErr) {
      console.error("Failed to save teacher to DB:", dbErr);
    }

    // Create session token
    const secret = process.env.NEXTAUTH_SECRET || "science-exam-secret";
    const sessionToken = await createSessionToken(
      { email: userData.email, name: userData.name, image: userData.picture },
      secret
    );

    const res = NextResponse.redirect(new URL("/teacher/dashboard", req.url));
    res.cookies.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(new URL("/login?error=unknown", req.url));
  }
}
