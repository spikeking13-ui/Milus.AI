import { NextResponse } from 'next/server';
import { openai, DEEPSEEK_MODEL } from '@/lib/featherless';
import { storeMemory, retrieveMemory } from '@/lib/memory';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const userMessage = messages[messages.length - 1]?.content;

    // Retrieve relevant memories
    const memories = await retrieveMemory(userMessage);
    const memoryContext = memories.length > 0 
      ? `\n\nRelevant past conversation context:\n${memories.join('\n')}`
      : '';

    // Read global system message
    const systemMessagePath = path.join(process.cwd(), 'src/lib/system-message.md');
    const systemMessageContent = fs.readFileSync(systemMessagePath, 'utf8');

    const fullMessages = [
      { role: 'system', content: systemMessageContent + memoryContext },
      ...(messages || [])
    ];

    // Store user message in memory
    if (userMessage) {
      await storeMemory(userMessage, 'user');
    }

    const response = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: fullMessages,
      max_tokens: 4096,
      stream: true,
    });

    let fullAssistantResponse = '';
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullAssistantResponse += content;
            controller.enqueue(new TextEncoder().encode(content));
          }
        }
        // Store assistant response in memory after stream finishes
        if (fullAssistantResponse) {
          await storeMemory(fullAssistantResponse, 'assistant');
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('Featherless API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
