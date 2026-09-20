import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CACHE_PATH = './.embed-cache.json';

let cache: Record<string, number[]> = {};
if (fs.existsSync(CACHE_PATH)) {
  cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
}

/**
 * Returns the embedding for a piece of text, caching results locally
 * so repeated runs do not re-call the OpenAI API for the same text.
 */
export async function embed(text: string): Promise<number[]> {
  if (cache[text]) return cache[text];

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  const vector = response.data[0].embedding;
  cache[text] = vector;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));

  return vector;
}
