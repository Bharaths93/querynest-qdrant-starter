import { Router } from 'express';
import { db } from '../db';
import { embed } from '../embed';
import { migratePosts, filteredSearch } from '../qdrant';

export const searchRouter = Router();

// Run once to migrate existing posts from PostgreSQL into Qdrant.
searchRouter.post('/migrate', async (req, res) => {
  try {
    await migratePosts();
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Migration failed', err);
    res.status(500).json({ error: 'migration failed' });
  }
});

// Filtered semantic search via Qdrant.
// Do not change this handler's shape — only fix src/qdrant.ts.
searchRouter.get('/qdrant', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const communityId = Number(req.query.community_id);
  const limit = Math.min(Number(req.query.limit) || 10, 50);

  if (!q) return res.status(400).json({ error: "query 'q' is required" });
  if (!communityId) return res.status(400).json({ error: "'community_id' is required" });

  try {
    const results = await filteredSearch(q, communityId, limit);
    res.json({ results });
  } catch (err) {
    console.error('Qdrant search failed', err);
    res.status(500).json({ error: 'search failed' });
  }
});

// Reference: the same query against pgvector, for comparison.
searchRouter.get('/pgvector', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const communityId = Number(req.query.community_id);
  const limit = Math.min(Number(req.query.limit) || 10, 50);

  if (!q) return res.status(400).json({ error: "query 'q' is required" });

  const qVec = await embed(q);
  const { rows } = await db.query(
    `SELECT p.id, p.status, p.community_id,
            1 - (pe.embedding <=> $1) AS score
     FROM posts_embeddings pe
     JOIN posts p ON p.id = pe.post_id
     WHERE p.status = 'published' AND p.community_id = $2
     ORDER BY pe.embedding <=> $1
     LIMIT $3`,
    [JSON.stringify(qVec), communityId, limit]
  );

  res.json({ results: rows });
});
