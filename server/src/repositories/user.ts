import type { User } from "../types.js";

export type PublicUser = Pick<User, "id" | "account" | "username" | "role"> & { isGuest: boolean };
export type ManagedUser = Omit<User, "passwordHash"> & { isGuest: boolean; favoriteCount: number; historyCount: number };

export interface UserRepository {
  createGuest(): User;
  findActiveByAccount(account: string): User | undefined;
  bindAccount(userId: string, account: string, password: string, username?: string): { status: "ok"; user: User } | { status: "exists" };
  touchSession(userId: string, role: User["role"]): User | undefined;
  updateProfile(userId: string, username: string): User | undefined;
  changePassword(userId: string, oldPassword: string, newPassword: string): "ok" | "missing" | "invalid";
  listManagedUsers(): ManagedUser[];
}

export function publicUser(user: User): PublicUser {
  return { id: user.id, account: user.account, username: user.username, role: user.role, isGuest: user.isGuest ?? !user.account };
}
