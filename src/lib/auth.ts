import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "pd_id_session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";

export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

export function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 64).toString("hex");
}

export function verifyPin(pin: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPin(pin, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function sign(userId: string): string {
  return createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
}

function cookieValueFor(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function userIdFromCookieValue(value: string): string | null {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const userId = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const expected = sign(userId);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export async function createSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, cookieValueFor(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return userIdFromCookieValue(raw);
}

export type SessionUser = { id: string; name: string };

// Для серверных компонентов и server actions: если сессии нет или пользователь
// был удалён — уводит на /login. Использовать в начале каждой страницы/экшена,
// которые читают/пишут данные конкретного кабинета.
export async function requireUser(): Promise<SessionUser> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!user) redirect("/login");
  return user;
}
