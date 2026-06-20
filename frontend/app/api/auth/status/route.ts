import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://ali-mahmoud-830-urei-scraper-api.hf.space";

export async function GET() {
  try {
    const sessionToken = cookies().get('session_key')?.value;
    if (!sessionToken) {
      return NextResponse.json({ user: null, trial_enabled: true, free_limit: 50 }, { status: 200 });
    }

    const res = await fetch(`${API_BASE}/api/auth/status`, {
      headers: { "Authorization": `Bearer ${sessionToken}` }
    });
    const data = await res.json();

    if (!res.ok) {
      cookies().delete('session_key');
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ user: null, trial_enabled: true, free_limit: 50 }, { status: 500 });
  }
}
