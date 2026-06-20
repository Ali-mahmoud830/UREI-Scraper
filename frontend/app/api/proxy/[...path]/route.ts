import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://ali-mahmoud-830-urei-scraper-api.hf.space";

export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  try {
    const sessionToken = cookies().get('session_key')?.value;
    const pathSlug = params.path.join('/');
    let body;
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }

    const res = await fetch(`${API_BASE}/api/${pathSlug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {})
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  try {
    const sessionToken = cookies().get('session_key')?.value;
    const url = new URL(req.url);
    const pathSlug = params.path.join('/');

    // Support file blob downloads (Excel/CSV)
    const backendRes = await fetch(`${API_BASE}/api/${pathSlug}${url.search}`, {
      headers: {
        ...(sessionToken ? { "Authorization": `Bearer ${sessionToken}` } : {})
      },
      cache: 'no-store'
    });

    const contentType = backendRes.headers.get('content-type') || '';
    if (contentType.includes('application/vnd') || contentType.includes('text/csv')) {
      const blob = await backendRes.blob();
      return new NextResponse(blob, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': backendRes.headers.get('content-disposition') || ''
        }
      });
    }

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (e) {
    return NextResponse.json({ message: "Network error" }, { status: 500 });
  }
}
