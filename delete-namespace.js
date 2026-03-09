const { Turbopuffer } = require('@turbopuffer/turbopuffer');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, 'companion', '.env.local') });

const TURBOPUFFER_API_KEY = process.env.TURBOPUFFER_API_KEY;
const MEMORY_NAMESPACE = 'milus-ai-voyage-1024';

if (!TURBOPUFFER_API_KEY) {
  console.error('Error: TURBOPUFFER_API_KEY is not defined in .env.local');
  process.exit(1);
}

const tpuf = new Turbopuffer({
  apiKey: TURBOPUFFER_API_KEY,
  region: 'gcp-us-central1',
});

async function deleteNamespace() {
  console.log(`Attempting to delete all data in namespace: ${MEMORY_NAMESPACE}...`);
  try {
    const ns = tpuf.namespace(MEMORY_NAMESPACE);
    await ns.deleteAll();
    console.log(`Successfully deleted all data in namespace: ${MEMORY_NAMESPACE}`);
  } catch (error) {
    console.error(`Failed to delete namespace data: ${error.message}`);
  }
}

deleteNamespace();
