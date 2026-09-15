import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const existingSession = await getSessionUserId();
  if (existingSession) redirect("/today");

  const cabinets = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10 bg-neutral-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2.5 mb-7">
          <span className="w-11 h-11 rounded-2xl bg-ink-600 text-white flex items-center justify-center shadow-sm">
            <span className="font-display text-sm font-extrabold tracking-tight">ПД</span>
          </span>
          <p className="text-center font-display font-bold text-neutral-900 tracking-tight text-lg leading-none">ПД-ИД</p>
          <p className="text-xs text-neutral-500">План дня · Итог дня</p>
        </div>
        <LoginForm cabinets={cabinets} />
      </div>
    </div>
  );
}
