import { NextResponse } from 'next/server';
import { openai, DEEPSEEK_MODEL } from '@/lib/featherless';
import fs from 'fs';
import path from 'path';

const ONBOARDING_SCHEMA = {
  fullName: "string",
  preferredName: "string",
  age: "string",
  email: "string",
  relationships: [{ name: "string", relation: "string", frequency: "string" }],
  userBirthday: "string",
  hobbies: "string",
  caregiverName: "string",
  checkInTime: "string",
};

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    const systemPrompt = `You are Milus, a warm and empathetic companion for seniors. 
Your goal is to complete the user's onboarding by gathering the following information in a natural, conversational way.
Do not ask all questions at once. Be patient and friendly.

REQUIRED DATA SCHEMA:
${JSON.stringify(ONBOARDING_SCHEMA, null, 2)}

INSTRUCTIONS:
1. Start by introducing yourself if this is the beginning.
2. Ask questions one by one to fill the schema.
3. If the user provides multiple pieces of info, acknowledge them.
4. When ALL fields in the schema are reasonably filled, provide a warm goodbye message.
5. CRITICAL: At the very end of your final message, append the tag <ONBOARDING_END>.
6. CRITICAL: In your final message, also include the completed JSON data for the user profile encapsulated in <USR_JSON> tags.

Example final response:
"It was wonderful getting to know you! I'm all set up now. Goodbye! <ONBOARDING_END> <USR_JSON>{"fullName": "...", ...}</USR_JSON>"`;

    const response = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      stream: true,
    });

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            controller.enqueue(new TextEncoder().encode(content));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
