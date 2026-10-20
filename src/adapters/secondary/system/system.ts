import { randomUUID } from 'node:crypto';
import type { Clock, IdGenerator } from '../../../ports/secondary/system.js';

export const systemClock: Clock = { now: () => new Date() };
export const uuidGenerator: IdGenerator = { next: () => randomUUID() };
