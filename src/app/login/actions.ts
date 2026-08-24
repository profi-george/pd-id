"use server";

import { prisma } from "@/lib/prisma";
import { generateSalt, hashPin, verifyPin, createSession, clearSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const userId = String(formData.get("userId") ?? "");
  const pin = String(formData.get("pin") ?? "");
  if (!userId) return { error: "Выберите кабинет." };
  if (!pin) return { error: "Введите PIN." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !verifyPin(pin, user.pinSalt, user.pinHash)) {
    return { error: "Неверный PIN." };
  }

  await createSession(user.id);
  redirect("/today");
}

export async function createCabinetAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "");
  const pinConfirm = String(formData.get("pinConfirm") ?? "");

  if (!name) return { error: "Введите название кабинета." };
  if (pin.length < 4) return { error: "PIN должен быть не короче 4 символов." };
  if (pin !== pinConfirm) return { error: "PIN не совпадает." };

  const existing = await prisma.user.findUnique({ where: { name } });
  if (existing) return { error: "Кабинет с таким названием уже есть." };

  const salt = generateSalt();
  const user = await prisma.user.create({
    data: { name, pinSalt: salt, pinHash: hashPin(pin, salt) },
  });
  await prisma.appSettings.create({ data: { userId: user.id } });

  await createSession(user.id);
  redirect("/today");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
