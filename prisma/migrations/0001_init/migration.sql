-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Posts table (matches prisma/schema.prisma model Post)
CREATE TABLE "posts" (
  "id"           SERIAL PRIMARY KEY,
  "title"        TEXT NOT NULL,
  "text"         TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'published',
  "community_id" INTEGER NOT NULL,
  "author_id"    INTEGER NOT NULL,
  "language"     TEXT NOT NULL DEFAULT 'en',
  "created_at"   TIMESTAMP NOT NULL DEFAULT now()
);

-- Embeddings table (kept separate from the Prisma model because Prisma
-- does not natively manage the pgvector column type)
CREATE TABLE "posts_embeddings" (
  "id"        SERIAL PRIMARY KEY,
  "post_id"   INTEGER NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "embedding" vector(1536) NOT NULL
);

CREATE INDEX posts_embeddings_hnsw_idx
  ON "posts_embeddings"
  USING hnsw (embedding vector_cosine_ops);
