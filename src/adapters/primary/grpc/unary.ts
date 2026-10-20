import type { sendUnaryData, ServerUnaryCall } from '@grpc/grpc-js';
import { parseBearer } from '../shared/bearer.js';
import { toServiceError, type GrpcLogger } from './errors.js';

/** Adapts an async function to grpc-js's callback-style unary handler with error mapping. */
export function unary<Req, Res>(log: GrpcLogger, fn: (call: ServerUnaryCall<Req, Res>) => Promise<Res>) {
  return (call: ServerUnaryCall<Req, Res>, callback: sendUnaryData<Res>) => {
    fn(call).then(
      (res) => callback(null, res),
      (err) => callback(toServiceError(err, log)),
    );
  };
}

export function bearerFromMetadata(call: ServerUnaryCall<unknown, unknown>): string | null {
  return parseBearer(call.metadata.get('authorization')[0]);
}
