import { NextRequest, NextResponse } from 'next/server';
import { storeMemory, ensureNamespaceExists } from '@/lib/memory';

export async function POST(req: NextRequest) {
  try {
    const { text, role } = await req.json();

    if (!text || (role !== 'user' && role !== 'assistant')) {
      return NextResponse.json({ error: 'Missing text or role' }, { status: 400 });
    }

    await ensureNamespaceExists();
    await storeMemory(text, role);

    return NextResponse.json({ success: true, message: 'Memory stored successfully' });
  } catch (error: any) {
    console.error('Error in memory add API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
