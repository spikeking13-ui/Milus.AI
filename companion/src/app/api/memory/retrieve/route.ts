import { NextRequest, NextResponse } from 'next/server';
import { retrieveMemory } from '@/lib/memory';

export async function POST(req: NextRequest) {
  try {
    const { query, rerankInstruction, queryThreshold, rerankThreshold } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    const memories = await retrieveMemory(
      query,
      rerankInstruction || 'Relevant conversation history',
      queryThreshold !== undefined ? queryThreshold : 0.7,
      rerankThreshold !== undefined ? rerankThreshold : 0.7
    );

    return NextResponse.json({ success: true, memories });
  } catch (error: any) {
    console.error('Error in memory retrieve API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
