import {Pool, QueryResult, QueryResultRow} from 'pg'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js';

// pg is offical postgresql client for nodejs, it is a pure javascript implementation of the postgres protocol, it is a wrapper around the native postgres client, it provides a simple and consistent API for querying the database, it also provides connection pooling and other features.

export const pool = new Pool({
    host: env?.DB_Host,
    port: Number(env?.DB_Port),
    database: env?.DB_Name,
    user:env?.DB_User,
    password: env?.DB_Password
})
/*
    * What is a connection pool?
  * Instead of opening a new DB connection for every request, a pool:
  * keeps several connections open
  * reuses them
*/
export async function query <T extends QueryResultRow= QueryResultRow>(
    text: string,
    params?:unknown[]
) : Promise<QueryResult<T>>
{
  const result = await pool.query<T>(text, params as any[])
  return result;
}

export async function assertDatabaseConnection() {
  try {
      await pool.query('SELECT 1');
      logger.info('Connected to postgres database successfully');
  } catch (error) {
    logger.error('Error connecting to postgres database');
    throw error;
  }
}