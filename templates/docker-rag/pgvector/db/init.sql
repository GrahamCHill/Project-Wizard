CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_passages (
    index_name text NOT NULL,
    passage_id integer NOT NULL,
    source text NOT NULL,
    body text NOT NULL,
    embedding vector NOT NULL,
    PRIMARY KEY (index_name, passage_id)
);
