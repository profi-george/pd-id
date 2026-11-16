import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, nextWeekday } from "@/lib/dates";
import { initialOrderKey } from "@/lib/priority";
import type { PlannedTask } from "@/lib/buckets";

// Сохранение разобранных ИИ задач — общее для страницы добавления и
// Telegram-бота. Пользователь передаётся явно: у бота нет cookie-сессии.
export async function saveAiTasks(userId: string, tasks: PlannedTask[]) {
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
        userId,
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
}
