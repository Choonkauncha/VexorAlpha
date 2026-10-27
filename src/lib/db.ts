import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const logLevels: ('query' | 'info' | 'warn' | 'error')[] =
  process.env.PRISMA_LOG_QUERIES === 'true'
    ? ['query', 'warn', 'error']
    : process.env.NODE_ENV === 'production'
      ? ['error']
      : ['warn', 'error']

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevels,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
