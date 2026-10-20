import { ValidationError } from '../shared/errors.js';
import type { Email } from './email.js';

export const ROLES = ['customer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export interface UserProps {
  id: string;
  email: Email;
  name: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static register(input: { id: string; email: Email; name: string; passwordHash: string; now: Date }): User {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 100) {
      throw new ValidationError('Name must be 1-100 characters', { field: 'name' });
    }
    return new User({ ...input, name, role: 'customer', createdAt: input.now, updatedAt: input.now });
  }

  /** Rehydrate from persistence — no invariants re-checked. */
  static restore(props: UserProps): User {
    return new User(props);
  }

  get id() {
    return this.props.id;
  }
  get email() {
    return this.props.email;
  }
  get name() {
    return this.props.name;
  }
  get passwordHash() {
    return this.props.passwordHash;
  }
  get role() {
    return this.props.role;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  hasRole(role: Role): boolean {
    return this.props.role === role;
  }

  toSnapshot(): Readonly<UserProps> {
    return { ...this.props };
  }
}
