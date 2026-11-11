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
 */
export async function ensureCollection() {
  const exists = await qdrant.collectionExists(COLLECTION);
  if (exists.exists) return;

  await qdrant.createCollection(COLLECTION, {
    vectors: {
      size: 1536,
      distance: 'Cosine',
    },
    hnsw_config: { m: 16, ef_construct: 128 },
  });

  await qdrant.createPayloadIndex(COLLECTION, {
    field_name: 'status',
    field_schema: 'keyword',
  });

  await qdrant.createPayloadIndex(COLLECTION, {
    field_name: 'community_id',
    field_schema: 'integer',
  });
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
      `SELECT pe.id, pe.post_id, pe.embedding, p.status, p.community_id, p.author_id, p.language
       FROM posts_embeddings pe
       JOIN posts p ON p.id = pe.post_id
       ORDER BY pe.id
       LIMIT $1 OFFSET $2`,
      [BATCH, offset]
    );
    if (rows.length === 0) break;

    const points = rows.map((row: any) => ({
      id: row.post_id ?? row.id,
      vector: typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding,
      payload: {
        post_id: row.post_id ?? row.id,
        status: row.status,
        community_id: row.community_id,
        author_id: row.author_id,
        language: row.language,
      },
    }));

    await qdrant.upsert(COLLECTION, {
      wait: true,
      points,
    });

    offset += rows.length;
    console.log(`Migrated ${offset} points`);
  }
}

/**
 * Runs filtered semantic search.
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
    with_payload: true,
    filter: {
      must: [
        { key: 'status',       match: { value: 'published' } },
        { key: 'community_id', match: { value: communityId } },
        { key: 'language',     match: { value: 'en' } },
      ],
    },
  });

  return results.map(r => ({
    postId:      ((r.payload as any)?.post_id ?? r.id) as number,
    score:       Number(r.score.toFixed(4)),
    status:      (r.payload as any)?.status,
    communityId: (r.payload as any)?.community_id,
  }));
}
