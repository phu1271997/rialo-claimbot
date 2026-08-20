import express from 'express';
import { config } from './config.js';
import { startOrchestrator, stopOrchestrator } from './orchestrator.js';
import { healthRouter } from './routes/health.js';
import { adminRouter } from './routes/admin.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/health', healthRouter);
  app.use('/admin', adminRouter);
  app.get('/', (_req, res) => res.json({ service: 'claimbot-orchestrator' }));

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'HTTP server listening');
  });

  await startOrchestrator();

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    stopOrchestrator();
    server.close(() => process.exit(0));
    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err: String(err) }, 'Fatal error during startup');
  process.exit(1);
});
