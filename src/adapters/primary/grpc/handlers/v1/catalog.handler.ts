import type { UntypedServiceImplementation } from '@grpc/grpc-js';
import type { CatalogUseCases } from '../../../../../ports/primary/catalog.js';
import type { GrpcLogger } from '../../errors.js';
import { unary } from '../../unary.js';

interface ListShowsRequest {
  city: string;
  movieId: string;
  sort: string;
  limit: number;
}

export function catalogHandlers(catalog: CatalogUseCases, log: GrpcLogger): UntypedServiceImplementation {
  return {
    ListMovies: unary(log, async () => ({ movies: await catalog.listMovies() })),
    ListShows: unary<ListShowsRequest, object>(log, async (call) => {
      const { city, movieId, sort, limit } = call.request;
      // proto3 defaults unset strings to "" and ints to 0 — treat those as "not provided".
      const shows = await catalog.listShows({
        city: city || undefined,
        movieId: movieId || undefined,
        sort: sort || undefined,
        limit: limit || undefined,
      });
      return { shows };
    }),
  };
}
