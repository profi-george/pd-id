"use server";

import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, tomorrowDate, parseDateInputValue } from "@/lib/dates";
import { initialOrderKey } from "@/lib/priority";
import { requireUser } from "@/lib/auth";
import {
  chatWithAI,
  explainPriorityChange,
  type AiTaskEvaluation,
  type ChatMessage,
  type ChatResult,
} from "@/lib/ai";
import { isPriorityLabel, computePriority, PRIORITY_LABEL_TEXT } from "@/lib/priorityEngine";
import {
  getGoogleConnectionStatus,
  disconnectGoogle,
  createCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/googleCalendar";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function num(formData: FormData, key: string): number {
  return Number(formData.get(key));
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function bool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function dateOrNull(formData: FormData, key: string): Date | null {
  const raw = str(formData, key);
  if (!raw) return null;
  try {
    return parseDateInputValue(raw);
  } catch {
    return null;
  }
}

const DEFAULT_EVALUATION = {
  value: 3,
  costOfDelay: 3,
  urgency: 3,
  timeSensitivity: 3,
  goalAlignment: 3,
  effortMinutes: 30,
  alternativeQuality: 0,
  confidence: 0.5,
  deadline: null,
  financialConsequence: false,
};

// ---------- Настройки (текущая цель) ----------

export async function getCurrentGoal(): Promise<string | null> {
  const user = await requireUser();
  const settings = await prisma.appSettings.findUnique({ where: { userId: user.id } });
  return settings?.currentGoal ?? null;
}

export async function setCurrentGoal(formData: FormData) {
  const user = await requireUser();
  const currentGoal = str(formData, "currentGoal");
  await prisma.appSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, currentGoal: currentGoal || null },
    update: { currentGoal: currentGoal || null },
  });
  revalidatePath("/backlog");
}

// ---------- Проекты ----------

export async function createProject(formData: FormData) {
  const user = await requireUser();
  const name = str(formData, "name");
  if (!name) return null;
  const parentIdRaw = str(formData, "parentId");
  const project = await prisma.project.create({
    data: { name, parentId: parentIdRaw || null, userId: user.id },
  });
  revalidatePath("/projects");
  revalidatePath("/backlog");
  return { id: project.id, name: project.name, parentId: project.parentId };
}

// Обёртка для использования в <form action={...}> (там нужен возврат void)
export async function createProjectForm(formData: FormData) {
  await createProject(formData);
}

export async function renameProject(id: string, formData: FormData) {
  const user = await requireUser();
  const name = str(formData, "name");
  if (!name) return;
  await prisma.project.updateMany({ where: { id, userId: user.id }, data: { name } });
  revalidatePath("/projects");
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function deleteProject(id: string) {
  const user = await requireUser();
  await prisma.project.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/projects");
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// ---------- Задачи (ручное создание/редактирование, продвинутый режим) ----------

function evaluationFromForm(formData: FormData) {
  const timeSensitivity = num(formData, "timeSensitivity");
  return {
    value: num(formData, "value"),
    costOfDelay: num(formData, "costOfDelay"),
    // Срочность отдельным полем больше не собираем (не дублируем cost of delay/дедлайн) —
    // используем timeSensitivity как безопасное значение для NOT NULL-колонки в базе.
    urgency: timeSensitivity,
    timeSensitivity,
    goalAlignment: num(formData, "goalAlignment"),
    effortMinutes: num(formData, "effortMinutes"),
    alternativeQuality: 0,
    confidence: 1, // введено вручную — считаем полностью уверенным
    deadline: dateOrNull(formData, "deadline"),
    financialConsequence: bool(formData, "financialConsequence"),
  };
}

export async function createTask(formData: FormData) {
  const user = await requireUser();
  const text = str(formData, "text");
  if (!text) return;

  const projectIdRaw = str(formData, "projectId");
  const projectId = projectIdRaw ? projectIdRaw : null;
  const resultText = str(formData, "resultText");
  const dateOption = str(formData, "dateOption"); // backlog | today | tomorrow

  const evaluation = evaluationFromForm(formData);

  let date: Date | null = null;
  let status: TaskStatus = TaskStatus.BACKLOG;
  let order = 0;

  if (dateOption === "today") {
    date = todayDate();
    status = TaskStatus.PLANNED;
    order = initialOrderKey(evaluation);
  } else if (dateOption === "tomorrow") {
    date = tomorrowDate();
    status = TaskStatus.PLANNED;
    order = initialOrderKey(evaluation);
  }

  await prisma.task.create({
    data: {
      text,
      resultText: resultText || null,
      projectId,
      userId: user.id,
      ...evaluation,
      date,
      status,
      order,
    },
  });

  revalidatePath("/backlog");
  revalidatePath("/today");

  redirect(dateOption === "backlog" ? "/backlog" : "/today");
}

export async function updateTask(id: string, formData: FormData) {
  const user = await requireUser();
  const text = str(formData, "text");
  if (!text) return;

  const projectIdRaw = str(formData, "projectId");
  const projectId = projectIdRaw ? projectIdRaw : null;
  const resultText = str(formData, "resultText");
  const evaluation = evaluationFromForm(formData);

  await prisma.task.updateMany({
    where: { id, userId: user.id },
    data: { text, resultText: resultText || null, projectId, ...evaluation },
  });

  revalidatePath("/backlog");
  revalidatePath("/today");
  redirect(str(formData, "returnTo") || "/backlog");
}

export async function createTasksBulk(formData: FormData) {
  const user = await requireUser();
  const raw = String(formData.get("lines") ?? "");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return;

  const projectIdRaw = str(formData, "projectId");
  const projectId = projectIdRaw ? projectIdRaw : null;
  const dateOption = str(formData, "dateOption"); // backlog | today | tomorrow

  let date: Date | null = null;
  let status: TaskStatus = TaskStatus.BACKLOG;
  if (dateOption === "today") {
    date = todayDate();
    status = TaskStatus.PLANNED;
  } else if (dateOption === "tomorrow") {
    date = tomorrowDate();
    status = TaskStatus.PLANNED;
  }

  for (const text of lines) {
    await prisma.task.create({
      data: {
        text,
        projectId,
        userId: user.id,
        ...DEFAULT_EVALUATION,
        date,
        status,
        order: status === TaskStatus.PLANNED ? initialOrderKey(DEFAULT_EVALUATION) : 0,
      },
    });
  }

  revalidatePath("/backlog");
  revalidatePath("/today");
  redirect(dateOption === "backlog" ? "/backlog" : "/today");
}

// ---------- Единый ввод задач с помощью ИИ ----------

export async function chatStep(
  history: ChatMessage[],
  message: string
): Promise<{ ok: true; result: ChatResult } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const [currentGoal, projects] = await Promise.all([
      getCurrentGoal(),
      prisma.project.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
    ]);
    const result = await chatWithAI(history, message, { currentGoal, today: new Date(), projects });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Неизвестная ошибка при обращении к ИИ." };
  }
}

export async function createTasksWithDetails(
  tasks: (AiTaskEvaluation & { projectId: string | null; includeInPlan: boolean })[]
) {
  const user = await requireUser();
  if (tasks.length === 0) return;

  for (const t of tasks) {
    if (!t.text.trim()) continue;
    const deadline = t.deadline ? new Date(`${t.deadline}T00:00:00.000Z`) : null;
    // Решение "в план или в бэклог" пользователь принимает по каждой задаче отдельно
    // (галочка в проверке перед сохранением) — ничего не добавляется в план молча.
    const date = t.includeInPlan
      ? t.scheduledDate
        ? new Date(`${t.scheduledDate}T00:00:00.000Z`)
        : todayDate()
      : null;
    const status = t.includeInPlan ? TaskStatus.PLANNED : TaskStatus.BACKLOG;
    await prisma.task.create({
      data: {
        text: t.text.trim(),
        resultText: t.resultText || null,
        motivationText: t.motivationText || null,
        projectId: t.projectId,
        userId: user.id,
        value: t.value,
        costOfDelay: t.costOfDelay,
        // Срочность отдельно AI больше не оценивает (дублировала cost of delay/дедлайн) —
        // безопасное значение для NOT NULL-колонки в базе.
        urgency: t.timeSensitivity,
        timeSensitivity: t.timeSensitivity,
        goalAlignment: t.goalAlignment,
        effortMinutes: t.effortMinutes,
        alternativeQuality: t.alternativeQuality,
        confidence: t.confidence,
        confidenceReason: t.confidenceReason || null,
        deadline,
        financialConsequence: t.financialConsequence,
        primaryReason: t.primaryReason || null,
        riskText: t.riskText || null,
        // Снимок исходных оценок AI — чтобы потом показать "изменено вручную",
        // если пользователь поправит значение в панели задачи.
        aiValue: t.value,
        aiCostOfDelay: t.costOfDelay,
        aiTimeSensitivity: t.timeSensitivity,
        aiEffortMinutes: t.effortMinutes,
        aiReasoningValue: t.reasoningValue || null,
        aiReasoningCostOfDelay: t.reasoningCostOfDelay || null,
        aiReasoningTimeSensitivity: t.reasoningTimeSensitivity || null,
        aiReasoningEffort: t.reasoningEffort || null,
        date,
        status,
        order: status === TaskStatus.PLANNED ? initialOrderKey({ ...t, urgency: t.timeSensitivity, deadline }) : 0,
      },
    });
  }

  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function updateTaskFields(
  taskId: string,
  patch: Partial<{
    text: string;
    projectId: string | null;
    value: number;
    costOfDelay: number;
    urgency: number;
    timeSensitivity: number;
    goalAlignment: number;
    effortMinutes: number;
    deadline: Date | null;
  }>
) {
  const user = await requireUser();
  await prisma.task.updateMany({ where: { id: taskId, userId: user.id }, data: patch });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function setManualPriority(taskId: string, label: string | null) {
  const user = await requireUser();
  if (label !== null && !isPriorityLabel(label)) return;
  // Явная смена группы кнопкой — отдельное действие от drag&drop, старая ручная
  // позиция внутри прежней группы тут больше не имеет смысла.
  await prisma.task.updateMany({
    where: { id: taskId, userId: user.id },
    data: { manualPriority: label, manualRank: null },
  });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// "Пересчитать" в расширенной настройке критериев (карандаш в карточке задачи):
// сохраняет новые значения критериев и просит AI заново коротко объяснить итоговую
// рекомендацию под них. Исходный AI-снимок (aiValue/aiCostOfDelay/...) не трогаем —
// он остаётся как есть, чтобы всегда было видно, что предложил AI изначально.
export async function recalculatePriority(
  taskId: string,
  patch: { value: number; costOfDelay: number; timeSensitivity: number; effortMinutes: number }
): Promise<{ ok: true; primaryReason: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
    if (!task) return { ok: false, error: "Задача не найдена." };

    const updated = { ...task, ...patch, urgency: patch.timeSensitivity };
    const { label } = computePriority(updated);

    const { primaryReason } = await explainPriorityChange({
      text: task.text,
      priorityLabel: PRIORITY_LABEL_TEXT[label],
      value: patch.value,
      costOfDelay: patch.costOfDelay,
      timeSensitivity: patch.timeSensitivity,
      effortMinutes: patch.effortMinutes,
      deadline: task.deadline ? task.deadline.toISOString().slice(0, 10) : null,
    });

    await prisma.task.update({
      where: { id: taskId },
      data: { ...patch, urgency: patch.timeSensitivity, primaryReason },
    });

    revalidatePath("/backlog");
    revalidatePath("/today");
    return { ok: true, primaryReason };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось пересчитать приоритет." };
  }
}

// Drag&drop внутри группы приоритета и между группами: group — итоговая (возможно та же)
// группа задачи, orderedIds — id всех задач ЭТОЙ группы в новом визуальном порядке (включая
// перетаскиваемую). Ручное решение пользователя главнее AI и не должно затираться при
// следующем ИИ-анализе — поэтому фиксируем и группу, и позицию.
export async function reorderPriorityTask(taskId: string, group: string, orderedIds: string[]) {
  const user = await requireUser();
  if (!isPriorityLabel(group)) return;
  await prisma.$transaction([
    prisma.task.updateMany({ where: { id: taskId, userId: user.id }, data: { manualPriority: group } }),
    ...orderedIds.map((id, index) =>
      prisma.task.updateMany({ where: { id, userId: user.id }, data: { manualRank: index } })
    ),
  ]);
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// ---------- Google-календарь ----------

export async function getGoogleStatus() {
  const user = await requireUser();
  return getGoogleConnectionStatus(user.id);
}

export async function disconnectGoogleAction() {
  const user = await requireUser();
  await disconnectGoogle(user.id);
  revalidatePath("/settings");
}

export async function addTaskToGoogleCalendar(
  taskId: string,
  input: { date: string; startTime: string; durationMinutes: number }
): Promise<{ ok: true; eventUrl: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
    if (!task) return { ok: false, error: "Задача не найдена." };

    const start = new Date(`${input.date}T${input.startTime}:00`);
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);

    const { eventId, eventUrl } = await createCalendarEvent(user.id, {
      title: task.text,
      description: task.resultText ?? undefined,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    });

    await prisma.task.update({
      where: { id: taskId },
      data: { googleEventId: eventId, googleEventUrl: eventUrl },
    });

    revalidatePath("/backlog");
    revalidatePath("/today");
    return { ok: true, eventUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Неизвестная ошибка." };
  }
}

export async function removeTaskFromGoogleCalendar(taskId: string) {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!task?.googleEventId) return;
  try {
    await deleteCalendarEvent(user.id, task.googleEventId);
  } catch {
    // событие могло быть уже удалено на стороне Google — не блокируем очистку у себя
  }
  await prisma.task.update({
    where: { id: taskId },
    data: { googleEventId: null, googleEventUrl: null },
  });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  await prisma.task.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// Быстрая отметка "выполнено" прямо из общего списка — без оценки 0-10, её
// пользователь при желании проставит вечером в Итоге дня для запланированных задач.
export async function completeTask(id: string) {
  const user = await requireUser();
  await prisma.task.updateMany({
    where: { id, userId: user.id },
    data: { status: TaskStatus.DONE },
  });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function scheduleTask(id: string, target: "today" | "tomorrow") {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return;

  const date = target === "today" ? todayDate() : tomorrowDate();
  const order = initialOrderKey(task);

  await prisma.task.update({
    where: { id },
    data: { date, status: TaskStatus.PLANNED, order },
  });

  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function scheduleTaskToDate(id: string, dateISO: string) {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return;

  const date = parseDateInputValue(dateISO);
  const order = initialOrderKey(task);

  await prisma.task.update({
    where: { id },
    data: { date, status: TaskStatus.PLANNED, order },
  });

  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function unscheduleTask(id: string) {
  const user = await requireUser();
  await prisma.task.updateMany({
    where: { id, userId: user.id },
    data: { date: null, status: TaskStatus.BACKLOG, order: 0 },
  });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function assignTaskToProject(taskId: string, projectId: string | null) {
  const user = await requireUser();
  await prisma.task.updateMany({
    where: { id: taskId, userId: user.id },
    data: { projectId },
  });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// ---------- Итог дня ----------

export async function submitEveningForm(formData: FormData) {
  const user = await requireUser();
  const dateISO = str(formData, "date");
  const date = parseDateInputValue(dateISO);
  const tomorrow = new Date(date);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const conclusion = str(formData, "conclusion");
  const difficulty = num(formData, "difficulty");
  const mood = num(formData, "mood");
  const efficiency = num(formData, "efficiency");
  const worry = num(formData, "worry");

  await prisma.day.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, conclusion, difficulty, mood, efficiency, worry },
    update: { conclusion, difficulty, mood, efficiency, worry },
  });

  const plannedTasks = await prisma.task.findMany({
    where: { date, status: TaskStatus.PLANNED, userId: user.id },
  });

  for (const task of plannedTasks) {
    const done = formData.get(`done_${task.id}`) === "on";
    const scoreRaw = str(formData, `score_${task.id}`);
    const score = scoreRaw === "" ? null : Math.max(0, Math.min(10, Number(scoreRaw)));
    const whySucceeded = str(formData, `whySucceeded_${task.id}`) || null;
    const whyFailed = str(formData, `whyFailed_${task.id}`) || null;

    if (done) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.DONE, score, whySucceeded, whyFailed: null },
      });
    } else {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.MOVED, score, whyFailed, whySucceeded: null },
      });
      await prisma.task.create({
        data: {
          text: task.text,
          resultText: task.resultText,
          motivationText: task.motivationText,
          projectId: task.projectId,
          userId: user.id,
          value: task.value,
          costOfDelay: task.costOfDelay,
          urgency: task.urgency,
          timeSensitivity: task.timeSensitivity,
          goalAlignment: task.goalAlignment,
          effortMinutes: task.effortMinutes,
          alternativeQuality: task.alternativeQuality,
          confidence: task.confidence,
          deadline: task.deadline,
          financialConsequence: task.financialConsequence,
          primaryReason: task.primaryReason,
          riskText: task.riskText,
          aiValue: task.aiValue,
          aiCostOfDelay: task.aiCostOfDelay,
          aiUrgency: task.aiUrgency,
          aiTimeSensitivity: task.aiTimeSensitivity,
          aiEffortMinutes: task.aiEffortMinutes,
          aiReasoningValue: task.aiReasoningValue,
          aiReasoningCostOfDelay: task.aiReasoningCostOfDelay,
          aiReasoningUrgency: task.aiReasoningUrgency,
          aiReasoningTimeSensitivity: task.aiReasoningTimeSensitivity,
          aiReasoningEffort: task.aiReasoningEffort,
          manualPriority: task.manualPriority,
          date: tomorrow,
          status: TaskStatus.PLANNED,
          order: initialOrderKey(task),
          score: null,
        },
      });
    }
  }

  revalidatePath("/today");
  redirect(`/today?date=${dateISO}`);
}
