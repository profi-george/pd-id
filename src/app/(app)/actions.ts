"use server";

import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, tomorrowDate, nextWeekday, parseDateInputValue, toDateInputValue, sameDate } from "@/lib/dates";
import { initialOrderKey } from "@/lib/priority";
import { requireUser } from "@/lib/auth";
import {
  chatWithAI,
  explainPriorityChange,
  answerConfidenceQuestion as aiAnswerConfidenceQuestion,
  friendlyAiError,
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

// ---------- Календарь цикла (см. src/lib/cycle.ts) ----------

export async function getCycleSettings() {
  const user = await requireUser();
  const settings = await prisma.appSettings.findUnique({ where: { userId: user.id } });
  return {
    cycleStartDate: settings?.cycleStartDate ?? null,
    cycleLengthDays: settings?.cycleLengthDays ?? null,
    periodLengthDays: settings?.periodLengthDays ?? null,
  };
}

export async function setCycleSettings(formData: FormData) {
  const user = await requireUser();
  const startISO = str(formData, "cycleStartDate");
  const cycleStartDate = startISO ? parseDateInputValue(startISO) : null;
  const cycleLengthRaw = str(formData, "cycleLengthDays");
  const cycleLengthDays = cycleLengthRaw ? Number(cycleLengthRaw) : null;
  const periodLengthRaw = str(formData, "periodLengthDays");
  const periodLengthDays = periodLengthRaw ? Number(periodLengthRaw) : null;
  await prisma.appSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, cycleStartDate, cycleLengthDays, periodLengthDays },
    update: { cycleStartDate, cycleLengthDays, periodLengthDays },
  });
  revalidatePath("/settings");
  revalidatePath("/today");
}

// Быстрая отметка "цикл начался сегодня" — без похода в настройки и без
// необходимости пересчитывать дату вручную каждый раз.
export async function markCycleStartToday() {
  const user = await requireUser();
  await prisma.appSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, cycleStartDate: todayDate() },
    update: { cycleStartDate: todayDate() },
  });
  revalidatePath("/settings");
  revalidatePath("/today");
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

// Приоритет проекта — небольшой модификатор в priorityEngine (см. PROJECT_PRIORITY_MOD),
// не отдельная система приоритизации. null = нейтрально, как будто не задан.
export async function setProjectPriority(id: string, priority: string | null) {
  const user = await requireUser();
  if (priority !== null && !isPriorityLabel(priority)) return;
  await prisma.project.updateMany({ where: { id, userId: user.id }, data: { priority } });
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
    // Введено вручную — но форма не отличает "осознанно поставила 3" от "просто не
    // тронула дефолт", поэтому 1.0 (стопроцентно) было бы неправдой: такая задача
    // выглядела бы увереннее, чем честно проанализированная AI. 0.9 — выше порога
    // низкой уверенности (не всплывает "AI не хватает данных" на ручной задаче,
    // это не про AI), но не ложный максимум.
    confidence: 0.9,
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

  redirect(dateOption === "backlog" ? "/today?view=all" : "/today");
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
  redirect(str(formData, "returnTo") || "/today?view=all");
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
  redirect(dateOption === "backlog" ? "/today?view=all" : "/today");
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
    return { ok: false, error: friendlyAiError(e) };
  }
}

export async function createTasksWithDetails(
  tasks: (AiTaskEvaluation & { projectId: string | null; includeInPlan: boolean; manualPriority?: string | null })[]
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
        : nextWeekday(todayDate())
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
        manualPriority: t.manualPriority || null,
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
    note: string | null;
  }>
) {
  const user = await requireUser();
  await prisma.task.updateMany({ where: { id: taskId, userId: user.id }, data: patch });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// Подзадачи — простой чек-лист внутри задачи, без своей приоритизации. Владение
// проверяем через связанную задачу (у Subtask своего userId нет).
export async function addSubtask(taskId: string, text: string) {
  const user = await requireUser();
  const trimmed = text.trim();
  if (!trimmed) return null;
  const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
  if (!task) return null;
  const count = await prisma.subtask.count({ where: { taskId } });
  const subtask = await prisma.subtask.create({ data: { text: trimmed, taskId, order: count } });
  revalidatePath("/backlog");
  revalidatePath("/today");
  return subtask;
}

export async function toggleSubtask(id: string, done: boolean) {
  const user = await requireUser();
  await prisma.subtask.updateMany({ where: { id, task: { userId: user.id } }, data: { done } });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function renameSubtask(id: string, text: string) {
  const user = await requireUser();
  const trimmed = text.trim();
  if (!trimmed) return;
  await prisma.subtask.updateMany({ where: { id, task: { userId: user.id } }, data: { text: trimmed } });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function deleteSubtask(id: string) {
  const user = await requireUser();
  await prisma.subtask.deleteMany({ where: { id, task: { userId: user.id } } });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// Своя дата у подзадачи — независимо от даты родительской задачи (например,
// один шаг уже сделан сегодня, другой отложен на конкретный день).
export async function scheduleSubtask(id: string, dateISO: string | null) {
  const user = await requireUser();
  const date = dateISO ? parseDateInputValue(dateISO) : null;
  await prisma.subtask.updateMany({ where: { id, task: { userId: user.id } }, data: { date } });
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
): Promise<
  { ok: true; primaryReason: string; confidence: number; confidenceReason: string | null }
  | { ok: false; error: string }
> {
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

    // Она сама только что подтвердила эти цифры вручную — старая "уверенность AI"
    // (и старая причина низкой уверенности) с прошлого разбора больше не в тему:
    // это уже не AI-оценка, а её собственная, и висящее "AI не хватило данных"
    // выглядело бы как чушь рядом с только что вручную выставленными значениями.
    const confidence = 0.9;
    const confidenceReason: string | null = null;

    await prisma.task.update({
      where: { id: taskId },
      data: { ...patch, urgency: patch.timeSensitivity, primaryReason, confidence, confidenceReason },
    });

    revalidatePath("/backlog");
    revalidatePath("/today");
    return { ok: true, primaryReason, confidence, confidenceReason };
  } catch (e) {
    return { ok: false, error: friendlyAiError(e) };
  }
}

// Ответ на уточняющий вопрос AI (низкий confidence) прямо из карточки задачи:
// пользователь вписывает недостающий факт, AI заново оценивает задачу целиком —
// новый факт может сдвинуть любой критерий, не только тот, из-за которого была
// низкая уверенность. aiValue/aiCostOfDelay/... тоже обновляются — это новая
// исходная оценка AI, а не ручная правка пользователя.
export async function answerConfidenceQuestion(
  taskId: string,
  answer: string
): Promise<{ ok: true; task: AiTaskEvaluation } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const task = await prisma.task.findFirst({ where: { id: taskId, userId: user.id } });
    if (!task) return { ok: false, error: "Задача не найдена." };
    if (!answer.trim()) return { ok: false, error: "Введите ответ." };

    const [currentGoal, projects] = await Promise.all([
      getCurrentGoal(),
      prisma.project.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
    ]);

    const evaluation = await aiAnswerConfidenceQuestion(
      {
        text: task.text,
        resultText: task.resultText,
        motivationText: task.motivationText,
        value: task.value,
        costOfDelay: task.costOfDelay,
        timeSensitivity: task.timeSensitivity,
        effortMinutes: task.effortMinutes,
        deadline: task.deadline ? task.deadline.toISOString().slice(0, 10) : null,
        confidenceReason: task.confidenceReason ?? "",
        answer,
      },
      { currentGoal, today: new Date(), projects }
    );
    if (!evaluation) return { ok: false, error: "Не удалось разобрать ответ AI. Попробуйте ещё раз." };

    const deadline = evaluation.deadline ? new Date(`${evaluation.deadline}T00:00:00.000Z`) : task.deadline;

    await prisma.task.update({
      where: { id: taskId },
      data: {
        value: evaluation.value,
        costOfDelay: evaluation.costOfDelay,
        urgency: evaluation.timeSensitivity,
        timeSensitivity: evaluation.timeSensitivity,
        effortMinutes: evaluation.effortMinutes,
        confidence: evaluation.confidence,
        confidenceReason: evaluation.confidenceReason || null,
        deadline,
        primaryReason: evaluation.primaryReason || null,
        riskText: evaluation.riskText || null,
        aiValue: evaluation.value,
        aiCostOfDelay: evaluation.costOfDelay,
        aiTimeSensitivity: evaluation.timeSensitivity,
        aiEffortMinutes: evaluation.effortMinutes,
        aiReasoningValue: evaluation.reasoningValue || null,
        aiReasoningCostOfDelay: evaluation.reasoningCostOfDelay || null,
        aiReasoningTimeSensitivity: evaluation.reasoningTimeSensitivity || null,
        aiReasoningEffort: evaluation.reasoningEffort || null,
      },
    });

    revalidatePath("/backlog");
    revalidatePath("/today");
    return { ok: true, task: { ...evaluation, deadline: deadline ? deadline.toISOString().slice(0, 10) : null } };
  } catch (e) {
    return { ok: false, error: friendlyAiError(e) };
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

    // "Z" здесь только чтобы посчитать конец интервала арифметикой эпохи — сама эта
    // дата никуда не отправляется. Реальное время, которое уйдёт в Google, — это
    // "наивные" локальные строки ниже + timeZone внутри createCalendarEvent, а не UTC.
    const start = new Date(`${input.date}T${input.startTime}:00Z`);
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);

    const { eventId, eventUrl } = await createCalendarEvent(user.id, {
      title: task.text,
      description: task.resultText ?? undefined,
      startISO: `${input.date}T${input.startTime}:00`,
      endISO: end.toISOString().slice(0, 19),
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
  const task = await prisma.task.findFirst({ where: { id, userId: user.id }, select: { date: true } });
  if (!task) return;
  await prisma.task.updateMany({
    where: { id, userId: user.id },
    // Без даты задача не попала бы ни в "Итог дня", ни в статистику "Истории" —
    // у неё никогда не было дня, к которому её можно привязать. Раз выполнена
    // именно сейчас — привязываем к сегодня, а не оставляем "невидимой".
    data: { status: TaskStatus.DONE, date: task.date ?? todayDate() },
  });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// Отмена "выполнено" прямо из списка (тот же ✓, повторный тап) — задача снова
// становится активной в плане. Сбрасываем оценку/рефлексию — они относились
// к прежнему "выполнено", отмеченному по ошибке или которое передумали.
export async function revertTaskStatus(id: string) {
  const user = await requireUser();
  await prisma.task.updateMany({
    where: { id, userId: user.id },
    // movedToDate тоже сбрасываем — иначе после отмены "частично выполнено"
    // на карточке осталась бы висеть стрелка на продолжение, которого для
    // этой записи больше нет.
    data: { status: TaskStatus.PLANNED, score: null, whySucceeded: null, whyFailed: null, movedToDate: null },
  });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// Если задачу двигают/убирают из плана мимо "Итога дня" (кнопки "На завтра"/"На дату"/
// "Убрать из плана"), а она была активно запланирована на КОНКРЕТНЫЙ день — не просто
// переезжаем на новую дату молча. Старая запись остаётся на исходном дне со статусом
// MOVED и movedToDate — "Итог дня" того дня сможет показать "перенесена → сюда", а не
// тихо потерять задачу. Сама задача продолжается новой записью на новом месте.
// Если задача просто лежала в бэклоге (без даты) — переносить в истории нечего,
// двигаем в той же записи.
async function relocateTask(
  userId: string,
  task: NonNullable<Awaited<ReturnType<typeof prisma.task.findFirst>>>,
  newDate: Date | null,
  newStatus: TaskStatus
) {
  // Задача уже когда-то была перенесена — её история продолжилась в копии
  // (movedFromTaskId у той копии указывает сюда), а эта запись "закрыта".
  // Повторное действие над ней — открытая карточка, не закрытая после первого
  // клика, второй нетерпеливый тап — не должно её "воскрешать" и превращать
  // в дубликат уже существующей копии; такую запись просто больше не трогаем.
  if (task.status === TaskStatus.MOVED) return;

  const wasOnAPlan = task.status === TaskStatus.PLANNED && task.date !== null;
  const unchanged = task.date && newDate && sameDate(task.date, newDate);

  if (!wasOnAPlan || unchanged) {
    await prisma.task.update({
      where: { id: task.id },
      data: { date: newDate, status: newStatus, order: newDate ? initialOrderKey(task) : 0, movedToDate: null },
    });
    return;
  }

  if (task.googleEventId) {
    // Старое событие относилось к дню, который задача теперь покидает — не оставляем
    // висеть напоминание о том, чего на этом месте больше нет.
    await deleteCalendarEvent(userId, task.googleEventId).catch(() => {});
  }

  // Атомарный условный update как мьютекс: если задачу параллельно уже перенёс
  // другой почти одновременный вызов (двойной тап, гонка двух запросов), этот
  // updateMany не найдёт status=PLANNED и затронет 0 строк — тогда копию ниже
  // не создаём, вместо того чтобы наплодить дубликат на новой дате.
  const relocated = await prisma.task.updateMany({
    where: { id: task.id, userId, status: TaskStatus.PLANNED },
    data: { status: TaskStatus.MOVED, movedToDate: newDate, googleEventId: null, googleEventUrl: null },
  });
  if (relocated.count === 0) return;

  // Подзадачи переносятся вместе с задачей — иначе чек-лист молча терялся бы
  // при каждом переносе на другой день.
  const subtasks = await prisma.subtask.findMany({ where: { taskId: task.id }, orderBy: { order: "asc" } });

  const createdTask = await prisma.task.create({
    data: {
      text: task.text,
      resultText: task.resultText,
      motivationText: task.motivationText,
      projectId: task.projectId,
      userId,
      value: task.value,
      costOfDelay: task.costOfDelay,
      urgency: task.urgency,
      timeSensitivity: task.timeSensitivity,
      goalAlignment: task.goalAlignment,
      effortMinutes: task.effortMinutes,
      alternativeQuality: task.alternativeQuality,
      confidence: task.confidence,
      confidenceReason: task.confidenceReason,
      deadline: task.deadline,
      financialConsequence: task.financialConsequence,
      primaryReason: task.primaryReason,
      riskText: task.riskText,
      note: task.note,
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
      date: newDate,
      status: newStatus,
      order: newDate ? initialOrderKey(task) : 0,
      movedFromTaskId: task.id,
    },
  });

  if (subtasks.length > 0) {
    await prisma.subtask.createMany({
      data: subtasks.map((s) => ({ text: s.text, done: s.done, order: s.order, date: s.date, taskId: createdTask.id })),
    });
  }
}

// Отмена переноса — вернуть задачу туда, где она была, если копия на новом месте
// ещё "нетронута" (не выполнена, не перенесена дальше). Если копию уже успели
// продвинуть — молча удалять её нельзя, потеряется реальная работа, поэтому
// в этом случае просто отказываем.
export async function undoMoveTask(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const original = await prisma.task.findFirst({
    where: { id, userId: user.id, status: TaskStatus.MOVED },
  });
  if (!original) return { ok: false };

  const duplicate = await prisma.task.findFirst({
    where: { userId: user.id, movedFromTaskId: original.id },
  });

  if (duplicate) {
    const untouched = duplicate.status === TaskStatus.PLANNED || duplicate.status === TaskStatus.BACKLOG;
    if (!untouched) return { ok: false };
    if (duplicate.googleEventId) {
      await deleteCalendarEvent(user.id, duplicate.googleEventId).catch(() => {});
    }
    await prisma.task.delete({ where: { id: duplicate.id } });
  }

  await prisma.task.update({
    where: { id: original.id },
    data: { status: TaskStatus.PLANNED, movedToDate: null },
  });

  revalidatePath("/backlog");
  revalidatePath("/today");
  revalidatePath("/today/summary");
  return { ok: true };
}

// «Частично выполнено»: задачу сделали не до конца — исходная запись закрывается
// (статус PARTIAL, что именно сделано — в whySucceeded, том же поле, что и в
// Итоге дня), а хвост продолжается отдельной новой задачей на выбранный день,
// с заметкой о том, что осталось. Незавершённые подзадачи переезжают вместе
// с хвостом — уже отмеченные остаются при исходной записи как часть истории.
export async function splitPartialTask(
  id: string,
  input: { doneNote: string | null; remainingNote: string | null; newDate: Date | null }
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return { ok: false };

  if (task.googleEventId) {
    await deleteCalendarEvent(user.id, task.googleEventId).catch(() => {});
  }

  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.PARTIAL,
      whySucceeded: input.doneNote || null,
      movedToDate: input.newDate,
      googleEventId: null,
      googleEventUrl: null,
    },
  });

  const createdTask = await prisma.task.create({
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
      confidenceReason: task.confidenceReason,
      deadline: task.deadline,
      financialConsequence: task.financialConsequence,
      primaryReason: task.primaryReason,
      riskText: task.riskText,
      note: input.remainingNote || task.note || null,
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
      date: input.newDate,
      status: input.newDate ? TaskStatus.PLANNED : TaskStatus.BACKLOG,
      order: input.newDate ? initialOrderKey(task) : 0,
      movedFromTaskId: task.id,
    },
  });

  const subtasks = await prisma.subtask.findMany({ where: { taskId: task.id, done: false }, orderBy: { order: "asc" } });
  if (subtasks.length > 0) {
    await prisma.subtask.createMany({
      data: subtasks.map((s) => ({ text: s.text, done: false, order: s.order, date: s.date, taskId: createdTask.id })),
    });
  }

  revalidatePath("/backlog");
  revalidatePath("/today");
  revalidatePath("/today/summary");
  return { ok: true };
}

export async function scheduleTask(id: string, target: "today" | "tomorrow") {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return;

  const date = target === "today" ? todayDate() : tomorrowDate();
  await relocateTask(user.id, task, date, TaskStatus.PLANNED);

  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function scheduleTaskToDate(id: string, dateISO: string) {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return;

  const date = parseDateInputValue(dateISO);
  await relocateTask(user.id, task, date, TaskStatus.PLANNED);

  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function unscheduleTask(id: string) {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return;

  await relocateTask(user.id, task, null, TaskStatus.BACKLOG);

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
  const whyWorked = str(formData, "whyWorked") || null;
  const whyNotWorked = str(formData, "whyNotWorked") || null;

  const cycleDayRaw = str(formData, "cycleDay");
  const cycleDay = cycleDayRaw === "" ? null : Number(cycleDayRaw);
  const hasPms = str(formData, "hasPms") === "yes";
  const hadConflict = str(formData, "hadConflict") === "yes";
  // "С кем"/"из-за чего" заполняются только при hadConflict=true — при "Нет"
  // не сохраняем их, даже если в скрытых полях что-то осталось от прошлого раза.
  const conflictWith = hadConflict ? str(formData, "conflictWith") || null : null;
  const conflictAbout = hadConflict ? str(formData, "conflictAbout") || null : null;

  await prisma.day.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: {
      userId: user.id, date, conclusion, difficulty, mood, efficiency, worry, whyWorked, whyNotWorked,
      cycleDay, hasPms, hadConflict, conflictWith, conflictAbout,
    },
    update: {
      conclusion, difficulty, mood, efficiency, worry, whyWorked, whyNotWorked,
      cycleDay, hasPms, hadConflict, conflictWith, conflictAbout,
    },
  });

  // PLANNED (ещё не отмечены) + DONE (отмечены галочкой в течение дня раньше) —
  // форма показывает оба набора, значит и сохранять должна оба.
  const plannedTasks = await prisma.task.findMany({
    where: { date, status: { in: [TaskStatus.PLANNED, TaskStatus.DONE, TaskStatus.NOT_DONE] }, userId: user.id },
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
      const reschedule = formData.get(`reschedule_${task.id}`) === "on";

      if (task.googleEventId) {
        // Задача не сделана в этот день — событие в календаре больше не отражает
        // реальность (перенесена или просто не случилась). Не оставляем висеть
        // напоминание о том, чего уже не будет.
        await deleteCalendarEvent(user.id, task.googleEventId).catch(() => {});
      }

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: reschedule ? TaskStatus.MOVED : TaskStatus.NOT_DONE,
          // При переносе фиксируем, куда именно — иначе "Итог дня"/список задач
          // того дня показывали бы "перенесена"/"убрана из плана" без даты, и
          // "отменить перенос" не смог бы найти копию обратно (см. movedFromTaskId
          // на созданной ниже копии).
          movedToDate: reschedule ? tomorrow : null,
          score,
          whyFailed,
          whySucceeded: null,
          googleEventId: null,
          googleEventUrl: null,
        },
      });
      if (!reschedule) continue;

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
          movedFromTaskId: task.id,
        },
      });
    }
  }

  revalidatePath("/today");
  // На завтра, а не обратно на только что закрытый день — это и есть следующий шаг
  // после "Итог дня": посмотреть, что перенеслось, и продолжить планировать.
  redirect(`/today?date=${toDateInputValue(tomorrow)}`);
}
