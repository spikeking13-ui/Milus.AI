import OpenAI from 'openai';

export const openai = new OpenAI({
  baseURL: 'https://api.featherless.ai/v1',
  apiKey: process.env.FEATHERLESS_API_KEY || 'rc_00e39275bf95f35abe3915ccfbf5b7c09c8a334b13e44dcd9256a78c75ec490a',
});

export const DEEPSEEK_MODEL = 'deepseek-ai/DeepSeek-V3.2';
