import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Neon + Vercel: keep pool tiny so serverless instances don't exhaust connections.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: isServerless ? 1 : Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: isServerless ? 5_000 : 30_000,
  connectionTimeoutMillis: 10_000,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export default prisma;
