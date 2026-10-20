import type { Cinema, Screen } from '../../domain/catalog/cinema.js';

export interface CinemaRepository {
  create(cinema: Cinema): Promise<void>;
  findById(id: string): Promise<Cinema | null>;
  addScreen(screen: Screen): Promise<void>;
  findScreen(id: string): Promise<Screen | null>;
}
