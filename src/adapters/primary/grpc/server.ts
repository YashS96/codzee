import { Server, ServerCredentials } from '@grpc/grpc-js';
import type { AuthUseCases } from '../../../ports/primary/auth.js';
import type { CatalogUseCases } from '../../../ports/primary/catalog.js';
import type { HealthUseCases } from '../../../ports/primary/health.js';
import type { GrpcLogger } from './errors.js';
import { authHandlers } from './handlers/v1/auth.handler.js';
import { catalogHandlers } from './handlers/v1/catalog.handler.js';
import { healthHandlers } from './handlers/v1/health.handler.js';
import { loadProtos } from './proto.js';

export interface GrpcDeps {
  auth: AuthUseCases;
  health: HealthUseCases;
  catalog: CatalogUseCases;
  log: GrpcLogger;
  maxMessageBytes: number;
}

export interface GrpcServer {
  /** Binds and starts serving; resolves with the bound port (useful when port is 0). */
  listen(host: string, port: number): Promise<number>;
  /** Stops accepting calls and waits for in-flight ones, forcing after timeoutMs. */
  close(timeoutMs: number): Promise<void>;
}

export function buildGrpcServer(deps: GrpcDeps): GrpcServer {
  const { authService, catalogService, healthService } = loadProtos();
  const server = new Server({
    'grpc.max_receive_message_length': deps.maxMessageBytes,
    'grpc.max_send_message_length': deps.maxMessageBytes,
  });
  server.addService(authService.service, authHandlers(deps.auth, deps.log));
  server.addService(catalogService.service, catalogHandlers(deps.catalog, deps.log));
  server.addService(healthService.service, healthHandlers(deps.health, deps.log));

  return {
    listen: (host, port) =>
      new Promise((resolve, reject) => {
        // Plaintext: TLS is expected to terminate at the ingress / service mesh.
        server.bindAsync(`${host}:${port}`, ServerCredentials.createInsecure(), (err, bound) =>
          err ? reject(err) : resolve(bound),
        );
      }),
    close: (timeoutMs) =>
      new Promise((resolve) => {
        const force = setTimeout(() => {
          server.forceShutdown();
          resolve();
        }, timeoutMs);
        server.tryShutdown(() => {
          clearTimeout(force);
          resolve();
        });
      }),
  };
}
