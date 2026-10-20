import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

export const PROTO_ROOT = path.resolve('proto');
export const PROTO_FILES = ['codzee/v1/auth.proto', 'codzee/v1/catalog.proto', 'grpc/health/v1/health.proto'];

/** Loads .proto files at runtime (no codegen). Field names are camelCased: refresh_token -> refreshToken. */
export function loadProtos(root = PROTO_ROOT) {
  const definition = protoLoader.loadSync(PROTO_FILES, {
    includeDirs: [root],
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const pkg = grpc.loadPackageDefinition(definition) as unknown as {
    codzee: {
      v1: { AuthService: grpc.ServiceClientConstructor; CatalogService: grpc.ServiceClientConstructor };
    };
    grpc: { health: { v1: { Health: grpc.ServiceClientConstructor } } };
  };
  return {
    authService: pkg.codzee.v1.AuthService,
    catalogService: pkg.codzee.v1.CatalogService,
    healthService: pkg.grpc.health.v1.Health,
  };
}
