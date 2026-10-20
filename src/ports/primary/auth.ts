import type { Role } from '../../domain/user/user.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface UserView {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface AuthenticatedPrincipal {
  userId: string;
  role: Role;
  jti: string;
  exp: number;
}

export interface AuthUseCases {
  register(input: { email: string; name: string; password: string }): Promise<UserView>;
  login(input: { email: string; password: string }): Promise<AuthTokens>;
  refresh(refreshToken: string): Promise<AuthTokens>;
  logout(input: { principal: AuthenticatedPrincipal; refreshToken?: string }): Promise<void>;
  authenticate(accessToken: string): Promise<AuthenticatedPrincipal>;
  getProfile(userId: string): Promise<UserView>;
}
