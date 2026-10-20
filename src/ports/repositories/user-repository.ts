import type { Email } from '../../domain/user/email.js';
import type { User } from '../../domain/user/user.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  /** Must throw ConflictError when the email is already taken. */
  create(user: User): Promise<void>;
}
