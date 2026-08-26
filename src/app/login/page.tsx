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
        <p className="text-center font-display font-bold text-neutral-800 tracking-tight mb-6 text-lg">ПД-ИД</p>
        <LoginForm cabinets={cabinets} />
      </div>
    </div>
  );
}
