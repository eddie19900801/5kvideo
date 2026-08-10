import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { User } from "../types.js";
import type { DatabaseRepository } from "./database.js";
import type { ManagedUser, UserRepository } from "./user.js";

export class JsonUserRepository implements UserRepository {
  constructor(private readonly database: DatabaseRepository) {}

  createGuest(): User {
    const now = new Date().toISOString();
    const user: User = { id: `guest-${randomUUID()}`, account: "", passwordHash: "", username: "游客", role: "user", status: "active", isGuest: true, visitCount: 1, totalWatchSeconds: 0, lastSeenAt: now, createdAt: now };
    return this.database.transaction((database) => { database.users.push(user); return user; });
  }

  findActiveByAccount(account: string): User | undefined {
    return this.database.read().users.find((user) => user.account === account && user.status === "active");
  }

  bindAccount(userId: string, account: string, password: string, username?: string) {
    return this.database.transaction((database) => {
      if (database.users.some((user) => user.account === account)) return { status: "exists" as const };
      const now = new Date().toISOString();
      let user = database.users.find((item) => item.id === userId);
      if (!user) {
        user = { id: userId, account: "", passwordHash: "", username: "游客", role: "user", status: "active", isGuest: true, createdAt: now };
        database.users.push(user);
      }
      user.account = account;
      user.passwordHash = bcrypt.hashSync(password, 12);
      user.username = username || user.username;
      user.isGuest = false;
      user.lastSeenAt = now;
      return { status: "ok" as const, user };
    });
  }

  touchSession(userId: string, role: User["role"]): User | undefined {
    return this.database.transaction((database) => {
      let user = database.users.find((item) => item.id === userId);
      if (!user && role === "user") {
        user = { id: userId, account: "", passwordHash: "", username: "游客", role: "user", status: "active", isGuest: true, visitCount: 0, totalWatchSeconds: 0, createdAt: new Date().toISOString() };
        database.users.push(user);
      }
      if (!user) return undefined;
      user.lastSeenAt = new Date().toISOString();
      user.visitCount = (user.visitCount || 0) + 1;
      return user;
    });
  }

  updateProfile(userId: string, username: string): User | undefined {
    return this.database.transaction((database) => {
      const user = database.users.find((item) => item.id === userId && item.status === "active");
      if (!user) return undefined;
      user.username = username;
      user.lastSeenAt = new Date().toISOString();
      return user;
    });
  }

  changePassword(userId: string, oldPassword: string, newPassword: string) {
    return this.database.transaction((database) => {
      const user = database.users.find((item) => item.id === userId && item.status === "active" && !!item.account);
      if (!user) return "missing" as const;
      if (!bcrypt.compareSync(oldPassword, user.passwordHash)) return "invalid" as const;
      user.passwordHash = bcrypt.hashSync(newPassword, 12);
      user.lastSeenAt = new Date().toISOString();
      return "ok" as const;
    });
  }

  listManagedUsers(): ManagedUser[] {
    const database = this.database.read();
    return database.users.filter((user) => user.role === "user").map(({ passwordHash: _, ...user }) => ({
      ...user,
      isGuest: user.isGuest ?? !user.account,
      favoriteCount: database.favorites.filter((item) => item.userId === user.id).length,
      historyCount: database.progress.filter((item) => item.userId === user.id).length,
    }));
  }
}
