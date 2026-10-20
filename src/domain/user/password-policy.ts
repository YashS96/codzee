import { ValidationError } from '../shared/errors.js';

export function assertPasswordPolicy(plain: string): void {
  if (plain.length < 8 || plain.length > 72) {
    throw new ValidationError('Password must be 8-72 characters', { field: 'password' });
  }
  if (!/[A-Za-z]/.test(plain) || !/\d/.test(plain)) {
    throw new ValidationError('Password must contain a letter and a digit', { field: 'password' });
  }
}
