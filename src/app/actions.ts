"use server";

import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, tomorrowDate, parseDateInputValue } from "@/lib/dates";
import { initialOrderKey } from "@/lib/priority";
import {
  chatWithAI,
  type AiTaskEvaluation,
  type ChatMessage,
  type ChatResult,
} from "@/lib/ai";
import { isPriorityLabel } from "@/lib/priorityEngine";
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
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return settings?.currentGoal ?? null;
}

export async function setCurrentGoal(formData: FormData) {
  const currentGoal = str(formData, "currentGoal");
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", currentGoal: currentGoal || null },
    update: { currentGoal: currentGoal || null },
  });
  revalidatePath("/backlog");
}

// ---------- Проекты ----------

export async function createProject(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return null;
  const parentIdRaw = str(formData, "parentId");
  const project = await prisma.project.create({ data: { name, parentId: parentIdRaw || null } });
  revalidatePath("/projects");
  revalidatePath("/backlog");
  return { id: project.id, name: project.name, parentId: project.parentId };
}

// Обёртка для использования в <form action={...}> (там нужен возврат void)
export async function createProjectForm(formData: FormData) {
  await createProject(formData);
}

export async function renameProject(id: string, formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  await prisma.project.update({ where: { id }, data: { name } });
  revalidatePath("/projects");
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function deleteProject(id: string) {
  await prisma.project.delete({ where: { id } });
  revalidatePath("/projects");
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// ---------- Задачи (ручное создание/редактирование, продвинутый режим) ----------

function evaluationFromForm(formData: FormData) {
  return {
    value: num(formData, "value"),
    costOfDelay: num(formData, "costOfDelay"),
    urgency: num(formData, "urgency"),
    timeSensitivity: num(formData, "timeSensitivity"),
    goalAlignment: num(formData, "goalAlignment"),
    effortMinutes: num(formData, "effortMinutes"),
    alternativeQuality: 0,
    confidence: 1, // введено вручную — считаем полностью уверенным
    deadline: dateOrNull(formData, "deadline"),
    financialConsequence: bool(formData, "financialConsequence"),
  };
}

export async function createTask(formData: FormData) {
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
  const text = str(formData, "text");
  if (!text) return;

  const projectIdRaw = str(formData, "projectId");
  const projectId = projectIdRaw ? projectIdRaw : null;
  const resultText = str(formData, "resultText");
  const evaluation = evaluationFromForm(formData);

  await prisma.task.update({
    where: { id },
    data: { text, resultText: resultText || null, projectId, ...evaluation },
  });

  revalidatePath("/backlog");
  revalidatePath("/today");
  redirect(str(formData, "returnTo") || "/backlog");
}

export async function createTasksBulk(formData: FormData) {
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
    const [currentGoal, projects] = await Promise.all([
      getCurrentGoal(),
      prisma.project.findMany({ select: { id: true, name: true } }),
    ]);
    const result = await chatWithAI(history, message, { currentGoal, today: new Date(), projects });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Неизвестная ошибка при обращении к ИИ." };
  }
}

export async function createTasksWithDetails(
  tasks: (AiTaskEvaluation & { projectId: string | null })[],
  dateOption: "backlog" | "today" | "tomorrow"
) {
  if (tasks.length === 0) return;

  let date: Date | null = null;
  let status: TaskStatus = TaskStatus.BACKLOG;
  if (dateOption === "today") {
    date = todayDate();
    status = TaskStatus.PLANNED;
  } else if (dateOption === "tomorrow") {
    date = tomorrowDate();
    status = TaskStatus.PLANNED;
  }

  for (const t of tasks) {
    if (!t.text.trim()) continue;
    const deadline = t.deadline ? new Date(`${t.deadline}T00:00:00.000Z`) : null;
    await prisma.task.create({
      data: {
        text: t.text.trim(),
        resultText: t.resultText || null,
        motivationText: t.motivationText || null,
        projectId: t.projectId,
        value: t.value,
        costOfDelay: t.costOfDelay,
        urgency: t.urgency,
        timeSensitivity: t.timeSensitivity,
        goalAlignment: t.goalAlignment,
        effortMinutes: t.effortMinutes,
        alternativeQuality: t.alternativeQuality,
        confidence: t.confidence,
        deadline,
        financialConsequence: t.financialConsequence,
        primaryReason: t.primaryReason || null,
        riskText: t.riskText || null,
        // Снимок исходных оценок AI — чтобы потом показать "изменено вручную",
        // если пользователь поправит значение в панели задачи.
        aiValue: t.value,
        aiCostOfDelay: t.costOfDelay,
        aiUrgency: t.urgency,
        aiTimeSensitivity: t.timeSensitivity,
        aiEffortMinutes: t.effortMinutes,
        aiReasoningValue: t.reasoningValue || null,
        aiReasoningCostOfDelay: t.reasoningCostOfDelay || null,
        aiReasoningUrgency: t.reasoningUrgency || null,
        aiReasoningTimeSensitivity: t.reasoningTimeSensitivity || null,
        aiReasoningEffort: t.reasoningEffort || null,
        date,
        status,
        order: status === TaskStatus.PLANNED ? initialOrderKey({ ...t, deadline }) : 0,
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
  await prisma.task.update({ where: { id: taskId }, data: patch });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function setManualPriority(taskId: string, label: string | null) {
  if (label !== null && !isPriorityLabel(label)) return;
  await prisma.task.update({ where: { id: taskId }, data: { manualPriority: label } });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

// ---------- Google-календарь ----------

export async function getGoogleStatus() {
  return getGoogleConnectionStatus();
}

export async function disconnectGoogleAction() {
  await disconnectGoogle();
  revalidatePath("/settings");
}

export async function addTaskToGoogleCalendar(
  taskId: string,
  input: { date: string; startTime: string; durationMinutes: number }
): Promise<{ ok: true; eventUrl: string } | { ok: false; error: string }> {
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return { ok: false, error: "Задача не найдена." };

    const start = new Date(`${input.date}T${input.startTime}:00`);
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);

    const { eventId, eventUrl } = await createCalendarEvent({
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
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task?.googleEventId) return;
  try {
    await deleteCalendarEvent(task.googleEventId);
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
  await prisma.task.delete({ where: { id } });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function scheduleTask(id: string, target: "today" | "tomorrow") {
  const task = await prisma.task.findUnique({ where: { id } });
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

export async function assignTaskToProject(taskId: string, projectId: string | null) {
  await prisma.task.update({
    where: { id: taskId },
    data: { projectId },
  });
  revalidatePath("/backlog");
  revalidatePath("/today");
}

export async function reorderTasks(orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.task.update({
        where: { id },
        data: { order: index },
      })
    )
  );
  revalidatePath("/today");
}

// ---------- Итог дня ----------

export async function submitEveningForm(formData: FormData) {
  const dateISO = str(formData, "date");
  const date = parseDateInputValue(dateISO);
  const tomorrow = new Date(date);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const whyWorked = str(formData, "whyWorked");
  const whyNotWorked = str(formData, "whyNotWorked");
  const conclusion = str(formData, "conclusion");
  const difficulty = num(formData, "difficulty");
  const mood = num(formData, "mood");
  const efficiency = num(formData, "efficiency");
  const worry = num(formData, "worry");

  await prisma.day.upsert({
    where: { date },
    create: {
      date,
      whyWorked,
      whyNotWorked,
      conclusion,
      difficulty,
      mood,
      efficiency,
      worry,
    },
    update: {
      whyWorked,
      whyNotWorked,
      conclusion,
      difficulty,
      mood,
      efficiency,
      worry,
    },
  });

  const plannedTasks = await prisma.task.findMany({
    where: { date, status: TaskStatus.PLANNED },
  });

  for (const task of plannedTasks) {
    const done = formData.get(`done_${task.id}`) === "on";
    const scoreRaw = str(formData, `score_${task.id}`);
    const score = scoreRaw === "" ? null : Math.max(0, Math.min(10, Number(scoreRaw)));

    if (done) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.DONE, score },
      });
    } else {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.MOVED, score },
      });
      await prisma.task.create({
        data: {
          text: task.text,
          resultText: task.resultText,
          motivationText: task.motivationText,
          projectId: task.projectId,
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
  redirect("/today");
}
