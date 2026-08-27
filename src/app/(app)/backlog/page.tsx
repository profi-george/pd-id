import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// «Задачи» объединены с «Планом дня» в один экран (/today?view=all) — эта
// страница остаётся только как редирект для старых ссылок/закладок.
export default async function BacklogRedirect({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; filter?: string }>;
}) {
  const { project, filter } = await searchParams;
  const params = new URLSearchParams();
  params.set("view", "all");
  if (project) params.set("project", project);
  if (filter) params.set("filter", filter);
  redirect(`/today?${params.toString()}`);
}
