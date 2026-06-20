import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://ali-mahmoud-830-urei-scraper-api.hf.space";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    
    // Extract client headers to forward to the backend for accurate fingerprinting
    const forwardedFor = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    const res = await fetch(`${API_BASE}/api/auth/redeem`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-forwarded-for": forwardedFor,
        "user-agent": userAgent
      },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (res.ok && data.session_key) {
      cookies().set('session_key', data.session_key, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
      return NextResponse.json({ status: "success" });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}
