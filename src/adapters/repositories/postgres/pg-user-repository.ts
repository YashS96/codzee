import type pg from 'pg';
import type { UserRepository } from '../../../ports/repositories/user-repository.js';
import { ConflictError } from '../../../domain/shared/errors.js';
import { Email } from '../../../domain/user/email.js';
import { User, type Role } from '../../../domain/user/user.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  created_at: Date;
  updated_at: Date;
}

const UNIQUE_VIOLATION = '23505';
const COLUMNS = 'id, email, name, password_hash, role, created_at, updated_at';

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [
      email.value,
    ]);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async create(user: User): Promise<void> {
    const s = user.toSnapshot();
    try {
      await this.pool.query(`INSERT INTO users (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
        s.id,
        s.email.value,
        s.name,
        s.passwordHash,
        s.role,
        s.createdAt,
        s.updatedAt,
      ]);
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictError('Email is already registered', { field: 'email' });
      }
      throw err;
    }
  }
}

function toDomain(row: UserRow): User {
  return User.restore({
    id: row.id,
    email: Email.create(row.email),
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
