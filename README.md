# QueryNest: Qdrant Integration Starter

QueryNest is a developer Q&A platform. Engineers ask technical questions; others post answers. The team is migrating from pgvector to Qdrant to use filtered vector search.

## What is broken

The Qdrant integration module (`src/qdrant.ts`) was committed with several bugs. The app starts and the routes exist, but filtered search returns wrong results. Your task is to find and fix every problem. Do not assume the TODOs are the only issues.

**Symptoms you will observe:**

1. `GET /search/qdrant?q=how+to+speed+up+queries&community_id=1` returns draft posts and posts from other communities, it should return only published posts from community 1.
2. Each result has `id` and `score` but no `status`, `community_id`, or `author_id` fields.
3. `POST /search/migrate` logs `Migrated 0 points` and exits without upserting anything.
4. Filtered search on a large dataset is noticeably slow.

## Setup

```bash
# 1. Copy env file
cp .env.example .env
# Fill in QDRANT_URL, QDRANT_API_KEY (or leave blank for local Docker),
# DATABASE_URL, and OPENAI_API_KEY

# 2. Start Qdrant locally (optional, skip if using Qdrant Cloud)
docker run -p 6333:6333 qdrant/qdrant

# 3. Install dependencies
npm install

# 4. Run database migrations
npx prisma migrate deploy

# 5. Seed the database (creates 50 sample posts)
npx ts-node src/seed.ts

# 6. Start the server
npx ts-node src/index.ts
```

## Test queries

After setup, verify your fixes with these five requests:

```bash
# 1. Migrate posts to Qdrant (run first)
curl -X POST http://localhost:3000/search/migrate

# 2. Basic filtered search, should return only published posts in community 1
curl "http://localhost:3000/search/qdrant?q=how+to+speed+up+queries&community_id=1"

# 3. Should NOT return draft posts, check the status field in every result
curl "http://localhost:3000/search/qdrant?q=redis+caching&community_id=1"

# 4. Compare with pgvector, same query, different endpoint
curl "http://localhost:3000/search/pgvector?q=how+to+speed+up+queries&community_id=1"

# 5. Range of communities, community 2 results should NOT appear in community 1 search
curl "http://localhost:3000/search/qdrant?q=database+indexing&community_id=2"
```

## Submission

1. Fix `src/qdrant.ts` only. Do not change routes, schema, or the embedding model.
2. Test all five queries above.
3. Push your `fix/qdrant-integration` branch to your public fork.
4. Open a Pull Request within your own fork (base: `main`, compare: `fix/qdrant-integration`).
5. Submit the PR link.
