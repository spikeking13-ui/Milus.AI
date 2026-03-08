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

    // Read user profile if exists
    let userProfileContext = '';
    const usrDataDir = path.join(process.cwd(), 'usr_data');
    const profilePath = path.join(usrDataDir, 'user_profile.json');
    if (fs.existsSync(profilePath)) {
      const profileData = fs.readFileSync(profilePath, 'utf8');
      userProfileContext = `\n\nUser Profile JSON:\n<USR_JSON>\n${profileData}\n</USR_JSON>`;
    }

    // Read global system message
    const systemMessagePath = path.join(process.cwd(), 'src/lib/system-message.md');
    const systemMessageContent = fs.readFileSync(systemMessagePath, 'utf8');

    const tools = [
      {
        type: 'function',
        function: {
          name: 'query_memories',
          description: 'Search for relevant past conversation context and memories. Use this to recall facts about the user, their family, or past discussions.',
          parameters: {
            type: 'object',
            properties: {
              search_query: {
                type: 'string',
                description: 'The vector search query to find relevant text chunks.',
              },
              rerank_query: {
                type: 'string',
                description: 'A specific instruction for the reranker to prioritize certain types of information (e.g., "Find recent mentions of health goals").',
              },
            },
            required: ['search_query', 'rerank_query'],
          },
        },
      },
    ];

    const fullMessages = [
      { role: 'system', content: systemMessageContent + userProfileContext },
      ...(messages || [])
    ];

    // Store user message in memory
    if (userMessage) {
      await storeMemory(userMessage, 'user');
    }

    let response = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: fullMessages,
      max_tokens: 4096,
      stream: false, // Disable stream for initial tool check
      tools: tools as any,
    });

    let assistantMessage = response.choices[0].message;

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolMessages: any[] = [...fullMessages, assistantMessage];
      
      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type === 'function' && toolCall.function.name === 'query_memories') {
          const args = JSON.parse(toolCall.function.arguments);
          const memories = await retrieveMemory(args.search_query, args.rerank_query);
          
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: memories.length > 0 
              ? `Memories found (Metadata included):\n${memories.join('\n')}`
              : 'No relevant memories found.',
          });
        }
      }

      // Get final response after tool results
      const finalResponse = await openai.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages: toolMessages,
        max_tokens: 4096,
        stream: true,
      });

      let fullAssistantResponse = '';
      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of finalResponse) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullAssistantResponse += content;
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
          if (fullAssistantResponse) {
            await storeMemory(fullAssistantResponse, 'assistant');
          }
          controller.close();
        },
      });

      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // If no tool calls, stream the original response
    const streamingResponse = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: fullMessages,
      max_tokens: 4096,
      stream: true,
    });

    let fullAssistantResponse = '';
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of streamingResponse) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullAssistantResponse += content;
            controller.enqueue(new TextEncoder().encode(content));
          }
        }
        if (fullAssistantResponse) {
          await storeMemory(fullAssistantResponse, 'assistant');
        }
        controller.close();
      },
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (error: any) {
    console.error('Featherless API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
