export type ProjectNode = {
  id: string;
  name: string;
  parentId: string | null;
};

export type ProjectTreeNode = ProjectNode & { children: ProjectTreeNode[] };

// Строит дерево из плоского списка (поддерживается только один уровень вложенности в UI,
// но функция отработает любую глубину, если она вдруг появится в данных).
export function buildProjectTree(projects: ProjectNode[]): ProjectTreeNode[] {
  const byId = new Map<string, ProjectTreeNode>();
  for (const p of projects) byId.set(p.id, { ...p, children: [] });

  const roots: ProjectTreeNode[] = [];
  for (const p of projects) {
    const node = byId.get(p.id)!;
    if (p.parentId && byId.has(p.parentId)) {
      byId.get(p.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// Плоский список с отступами для использования в <select> — "Название" / "— Подпроект".
export function flattenProjectsForSelect(
  projects: ProjectNode[]
): { id: string; label: string }[] {
  const tree = buildProjectTree(projects);
  const out: { id: string; label: string }[] = [];
  function walk(nodes: ProjectTreeNode[], depth: number) {
    for (const n of nodes) {
      out.push({ id: n.id, label: `${"— ".repeat(depth)}${n.name}` });
      walk(n.children, depth + 1);
    }
  }
  walk(tree, 0);
  return out;
}

// Читаемый путь для отображения на карточке задачи: "Найм / Вакансия А".
export function projectPath(
  projectId: string | null,
  projectsById: Map<string, ProjectNode>
): string | null {
  if (!projectId) return null;
  const parts: string[] = [];
  let current = projectsById.get(projectId) ?? null;
  let guard = 0;
  while (current && guard < 10) {
    parts.unshift(current.name);
    current = current.parentId ? projectsById.get(current.parentId) ?? null : null;
    guard++;
  }
  return parts.join(" / ");
}

// id проекта и всех его потомков (для фильтра "показать всё внутри Найма").
export function projectAndDescendantIds(rootId: string, projects: ProjectNode[]): Set<string> {
  const byParent = new Map<string | null, ProjectNode[]>();
  for (const p of projects) {
    const key = p.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(p);
  }
  const ids = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of byParent.get(id) ?? []) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return ids;
}
