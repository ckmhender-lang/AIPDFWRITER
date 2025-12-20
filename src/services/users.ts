import argon2 from 'argon2';

export type UserRole = 'user' | 'admin';

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type PasswordResetToken = {
  token: string;
  userId: string;
  expiresAt: string;
  usedAt: string | null;
};

const usersById = new Map<string, User>();
const usersByEmail = new Map<string, User>();
const resetTokens = new Map<string, PasswordResetToken>();

export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string | null;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (usersByEmail.has(email)) {
    const err = new Error('Email already in use');
    (err as unknown as { statusCode?: number; code?: string }).statusCode = 409;
    (err as unknown as { statusCode?: number; code?: string }).code = 'EMAIL_IN_USE';
    throw err;
  }

  const now = new Date().toISOString();
  const user: User = {
    id: `usr_${crypto.randomUUID()}`,
    email,
    name: input.name ?? null,
    role: 'user',
    passwordHash: await hashPassword(input.password),
    createdAt: now,
    updatedAt: now,
  };

  usersById.set(user.id, user);
  usersByEmail.set(user.email, user);
  return user;
}

export function findUserByEmail(email: string): User | null {
  return usersByEmail.get(email.trim().toLowerCase()) ?? null;
}

export function findUserById(id: string): User | null {
  return usersById.get(id) ?? null;
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const user = usersById.get(userId);
  if (!user) return;
  const now = new Date().toISOString();
  const updated: User = {
    ...user,
    passwordHash: await hashPassword(newPassword),
    updatedAt: now,
  };
  usersById.set(updated.id, updated);
  usersByEmail.set(updated.email, updated);
}

export function createPasswordResetToken(userId: string, ttlMinutes = 60): PasswordResetToken {
  const now = Date.now();
  const expiresAt = new Date(now + ttlMinutes * 60_000).toISOString();
  const token: PasswordResetToken = {
    token: `rst_${crypto.randomUUID()}`,
    userId,
    expiresAt,
    usedAt: null,
  };
  resetTokens.set(token.token, token);
  return token;
}

export function consumePasswordResetToken(tokenValue: string): PasswordResetToken {
  const token = resetTokens.get(tokenValue);
  if (!token) {
    const err = new Error('Invalid token');
    (err as unknown as { statusCode?: number; code?: string }).statusCode = 400;
    (err as unknown as { statusCode?: number; code?: string }).code = 'INVALID_TOKEN';
    throw err;
  }
  if (token.usedAt) {
    const err = new Error('Token already used');
    (err as unknown as { statusCode?: number; code?: string }).statusCode = 400;
    (err as unknown as { statusCode?: number; code?: string }).code = 'TOKEN_USED';
    throw err;
  }
  if (new Date(token.expiresAt).getTime() < Date.now()) {
    const err = new Error('Token expired');
    (err as unknown as { statusCode?: number; code?: string }).statusCode = 400;
    (err as unknown as { statusCode?: number; code?: string }).code = 'TOKEN_EXPIRED';
    throw err;
  }

  const usedAt = new Date().toISOString();
  const updated: PasswordResetToken = { ...token, usedAt };
  resetTokens.set(tokenValue, updated);
  return updated;
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
