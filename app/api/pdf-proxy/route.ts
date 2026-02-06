import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route to proxy PDF files from mscmusic.org
 * This bypasses CORS restrictions for the PDF viewer
 */
export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Validate that the URL is from allowed sources
    const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    const allowed =
        url.startsWith('https://mscmusic.org/') ||
        (r2Url && url.startsWith(r2Url)) ||
        url.startsWith('https://firebasestorage.googleapis.com/') ||
        url.startsWith('https://pub-'); // Generic R2 public URLs sometimes

    if (!allowed) {
        console.error('Blocked blocked URL:', url);
        return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ChoirHub/1.0',
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch PDF: ${response.status}` },
                { status: response.status }
            );
        }

        const pdfBuffer = await response.arrayBuffer();

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'inline',
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            },
        });
    } catch (error) {
        console.error('PDF proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch PDF' },
            { status: 500 }
        );
    }
}
