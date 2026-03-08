import { Turbopuffer } from '@turbopuffer/turbopuffer';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

type MemoryRole = 'user' | 'assistant';

type VoyageEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

type VoyageRerankResponse = {
  data?: Array<{
    index?: number;
    relevance_score?: number;
  }>;
};

const MEMORY_NAMESPACE = 'milus-ai-voyage-1024';
const DISTANCE_METRIC = 'cosine_distance' as const;

function requireEnv(name: 'VOYAGE_API_KEY' | 'TURBOPUFFER_API_KEY') {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const tpuf = new Turbopuffer({
  apiKey: requireEnv('TURBOPUFFER_API_KEY'),
  region: 'gcp-us-central1',
});

export const ns = tpuf.namespace(MEMORY_NAMESPACE);

const MEMORY_SCHEMA = {
  text: {
    type: 'string' as const,
    full_text_search: true,
  },
};

async function callVoyage<T>(path: '/v1/embeddings' | '/v1/rerank', body: Record<string, unknown>) {
  console.log(`Voyage Request [${path}]:`, JSON.stringify(body, null, 2));
  const response = await fetch(`https://api.voyageai.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('VOYAGE_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Voyage Error [${path}] (${response.status}):`, errorText);
    throw new Error(`Voyage API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log(`Voyage Response [${path}]:`, JSON.stringify(data, null, 2));
  return data as T;
}

async function voyageVector(text: string, inputType: 'query' | 'document'): Promise<number[]> {
  const response = await callVoyage<VoyageEmbeddingResponse>('/v1/embeddings', {
    input: text,
    model: 'voyage-4',
    input_type: inputType,
    truncation: true,
  });

  const vector = response.data?.[0]?.embedding;
  if (!vector) {
    throw new Error('Failed to generate Voyage embedding');
  }

  return vector;
}

async function rerankMemories(query: string, documents: string[]) {
  const response = await callVoyage<VoyageRerankResponse>('/v1/rerank', {
    query,
    documents,
    model: 'rerank-2.5',
    top_k: Math.min(5, documents.length),
    truncation: true,
  });

  return response.data ?? [];
}

export async function ensureNamespaceExists() {
  try {
    const metadata = await ns.metadata();
    console.log('Turbopuffer Metadata:', JSON.stringify(metadata, null, 2));
    return metadata;
  } catch (error) {
    console.log('Namespace not found, initializing...', error);
    const writePayload = {
      upsert_rows: [
        {
          id: crypto.randomUUID(),
          vector: await voyageVector('__namespace_init__', 'document'),
          text: '__namespace_init__',
          role: 'assistant' as const,
          created_at: new Date().toISOString(),
        },
      ],
      distance_metric: DISTANCE_METRIC,
      schema: MEMORY_SCHEMA,
    };
    console.log('Turbopuffer Init Write Payload:', JSON.stringify(writePayload, null, 2));
    await ns.write(writePayload);

    const metadata = await ns.metadata();
    console.log('Turbopuffer Metadata (after init):', JSON.stringify(metadata, null, 2));
    return metadata;
  }
}

export async function storeMemory(text: string, role: MemoryRole) {
  await ensureNamespaceExists();

  const writePayload = {
    upsert_rows: [
      {
        id: crypto.randomUUID(),
        vector: await voyageVector(text, 'document'),
        text,
        role,
        created_at: new Date().toISOString(),
      },
    ],
    distance_metric: DISTANCE_METRIC,
    schema: MEMORY_SCHEMA,
  };

  console.log('Turbopuffer Store Write Payload:', JSON.stringify(writePayload, null, 2));
  const result = await ns.write(writePayload);
  console.log('Turbopuffer Store Result:', JSON.stringify(result, null, 2));
}

export async function retrieveMemory(
  query: string,
  rerankInstruction: string = 'Relevant conversation history',
  queryThreshold: number = 0.7,
  rerankThreshold: number = 0.7
) {
  await ensureNamespaceExists();

  const queryPayload = {
    rank_by: ['vector', 'ANN', await voyageVector(query, 'query')] as ['vector', 'ANN', number[]],
    top_k: 10,
    include_attributes: ['text', 'role', 'created_at'],
  };

  console.log('Turbopuffer Query Payload:', JSON.stringify(queryPayload, null, 2));
  const result = await ns.query(queryPayload);
  console.log('Turbopuffer Query Result:', JSON.stringify(result, null, 2));

  const documents = (result.rows ?? [])
    .filter((row) => {
      const distance = typeof row.$dist === 'number' ? row.$dist : Number.POSITIVE_INFINITY;
      const isWithinThreshold = distance <= 1 - queryThreshold;
      console.log(`Row distance: ${distance}, Threshold: ${1 - queryThreshold}, Keep: ${isWithinThreshold}`);
      return isWithinThreshold;
    })
    .map((row) => (typeof row.text === 'string' ? row.text : ''))
    .filter(Boolean);

  console.log(`Documents after filtering: ${documents.length}`);

  if (documents.length === 0) {
    console.log('No documents found after filtering, returning empty array.');
    return [];
  }

  console.log("uhygtf");

  const reranked = await rerankMemories(`${rerankInstruction}: ${query}`, documents);



  return reranked
    .filter((item) => (item.relevance_score ?? 0) >= rerankThreshold)
    .map((item) => documents[item.index ?? -1])
    .filter((item): item is string => Boolean(item));
}
