import json

import psycopg
from psycopg.rows import dict_row


StorageError = psycopg.Error


def ensure_index(name, records, embed):
    with psycopg.connect(connect_timeout=5) as connection:
        # A transaction-scoped lock prevents concurrent requests from writing the same index.
        connection.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (name,))
        count = connection.execute("SELECT count(*) FROM rag_passages WHERE index_name = %s", (name,)).fetchone()[0]
        if count == len(records):
            return
        vectors = embed([record["text"] for record in records])
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO rag_passages (index_name, passage_id, source, body, embedding)
                VALUES (%s, %s, %s, %s, %s::vector)
                ON CONFLICT (index_name, passage_id) DO UPDATE
                    SET source = EXCLUDED.source, body = EXCLUDED.body, embedding = EXCLUDED.embedding
                """,
                [
                    (name, index, record["source"], record["text"], json.dumps(vector))
                    for index, (vector, record) in enumerate(zip(vectors, records, strict=True), 1)
                ],
            )


def search(name, vector):
    with psycopg.connect(connect_timeout=5, row_factory=dict_row) as connection:
        return connection.execute(
            """
            SELECT source, body AS text
            FROM rag_passages
            WHERE index_name = %s
            ORDER BY embedding <=> %s::vector, passage_id
            LIMIT 3
            """,
            (name, json.dumps(vector)),
        ).fetchall()
