import { Pool, type PoolClient, type QueryResult } from "pg";
import { env } from "../config/env";

export type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : undefined
});

export const withTransaction = async <T>(
  handler: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const query = async <T>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> => pool.query<T>(text, values);
