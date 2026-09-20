import { db } from './db';
import { embed } from './embed';

const TOPICS = [
  'how to fix N+1 queries in Prisma',
  'Docker container crashes after a few seconds',
  'Redis vs database for session storage',
  'what is cache invalidation',
  'PostgreSQL index not being used',
  'HNSW vs IVFFlat for vector search',
  'debugging a memory leak in Node.js',
  'connection pool exhausted under load',
  'setting up full text search in Postgres',
  'why does my API return 200 with an empty body',
];

const COMMUNITIES = [1, 1, 1, 2, 2, 3];
const AUTHORS = [7, 12, 3, 9, 15];
const LANGUAGES = ['en', 'en', 'en', 'en', 'fr'];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function seed() {
  console.log('Seeding 50 posts...');

  for (let i = 0; i < 50; i++) {
    const topic = pick(TOPICS, i);
    const title = `${topic} (post ${i + 1})`;
    const text = `A community discussion about: ${topic}. This post walks through the problem, what was tried, and what worked.`;
    const status = i % 5 === 0 ? 'draft' : 'published'; // ~20% draft
    const communityId = pick(COMMUNITIES, i);
    const authorId = pick(AUTHORS, i);
    const language = pick(LANGUAGES, i);

    const { rows } = await db.query(
      `INSERT INTO posts (title, text, status, community_id, author_id, language)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [title, text, status, communityId, authorId, language]
    );
    const postId = rows[0].id;

    const vector = await embed(text);
    await db.query(
      `INSERT INTO posts_embeddings (post_id, embedding) VALUES ($1, $2)`,
      [postId, JSON.stringify(vector)]
    );

    process.stdout.write('.');
  }

  console.log('\nDone. Seeded 50 posts (roughly 20% draft, split across 3 communities).');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
