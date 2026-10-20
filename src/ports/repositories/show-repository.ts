import type { Show } from '../../domain/catalog/show.js';
import type { ShowFilter } from '../primary/catalog.js';

export interface ShowRepository {
  create(show: Show): Promise<void>;
  /** Upcoming shows matching the filter. */
  list(filter: ShowFilter): Promise<Show[]>;
}
