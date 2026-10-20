import { setTimeout as sleep } from 'node:timers/promises';
import { createContainer } from './bootstrap/container.js';
import { loadConfig } from './config/loader.js';

async function main() {
  const config = loadConfig();
  const { app, grpc, health, dispose } = await createContainer(config);

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    app.log.info({ signal }, 'shutdown requested — draining');
    const force = setTimeout(() => {
      app.log.error('graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, config.shutdown.timeoutMs);
    force.unref();

    health.markShuttingDown(); // readiness -> 503 so the load balancer stops routing here
    await sleep(config.shutdown.drainDelayMs);
    // stop accepting, finish in-flight requests on both transports
    await Promise.all([app.close(), grpc?.close(config.shutdown.timeoutMs)]);
    await dispose();
    app.log.info('shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => app.log.error({ err }, 'unhandled rejection'));

  await app.listen({ host: config.server.host, port: config.server.port });
  if (grpc) {
    const port = await grpc.listen(config.grpc.host, config.grpc.port);
    app.log.info({ port }, 'gRPC server listening');
  }
}

main().catch((err) => {
  // Logger may not exist yet (e.g. invalid config), so fall back to stderr.
  process.stderr.write(`fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
