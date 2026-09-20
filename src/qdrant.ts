import { QdrantClient } from '@qdrant/js-client-rest';
import { db } from './db';
import { embed } from './embed';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION = 'querynest_posts';

/**
 * Creates the Qdrant collection if it does not already exist.
 * BUG: The distance metric is wrong for text embeddings.
 */
export async function ensureCollection() {
  const exists = await qdrant.collectionExists(COLLECTION);
  if (exists.exists) return;

  await qdrant.createCollection(COLLECTION, {
    vectors: {
      size: 1536,
      distance: 'Euclid',   // BUG 1: wrong distance metric for text embeddings
    },
    hnsw_config: { m: 16, ef_construct: 128 },
  });

  // BUG 2: payload indexes are missing entirely
  // Without them, filtering works but is slow and the query planner
  // cannot choose pre-filter strategy for selective filters.
}

/**
 * Migrates posts from PostgreSQL into Qdrant.
 */
export async function migratePosts() {
  await ensureCollection();

  const BATCH = 500;
  let offset = 0;

  while (true) {
    const { rows } = await db.query(
      `SELECT pe.id, pe.embedding, p.status, p.community_id, p.author_id, p.language
       FROM posts_embeddings pe
       JOIN posts p ON p.id = pe.post_id
       ORDER BY pe.id
       LIMIT $1 OFFSET $2`,
      [BATCH, offset]
    );
    if (rows.length === 0) break;

    // TODO: upsert rows into Qdrant
    // Each point needs: id (integer), vector (embedding array), payload (metadata object)
    // Use qdrant.upsert(COLLECTION, { wait: false, points: [...] })

    offset += rows.length;
    console.log(`Migrated ${offset} points`);
  }
}

/**
 * Runs filtered semantic search.
 * BUG 3: filter uses 'should' (OR) instead of 'must' (AND).
 * BUG 4: with_payload is missing — results have no payload fields.
 */
export async function filteredSearch(
  query: string,
  communityId: number,
  limit = 10
) {
  const qVec = await embed(query);

  const results = await qdrant.search(COLLECTION, {
    vector: qVec,
    limit,
    // BUG 4: with_payload is missing here
    filter: {
      should: [          // BUG 3: should = OR; must = AND
        { key: 'status',       match: { value: 'published' } },
        { key: 'community_id', match: { value: communityId } },
        { key: 'language',     match: { value: 'en' } },
      ],
    },
  });

  return results.map(r => ({
    postId:      (r.payload as any)?.post_id as number,
    score:       Number(r.score.toFixed(4)),
    status:      (r.payload as any)?.status,
    communityId: (r.payload as any)?.community_id,
  }));
}
