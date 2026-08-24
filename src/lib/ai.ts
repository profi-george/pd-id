// ИИ здесь ТОЛЬКО оценивает критерии задачи и возвращает структурированные данные.
// Сам приоритет (score, ранжирование) всегда считает детерминированный код в
// lib/priorityEngine.ts — так порядок задач воспроизводим и не «плавает» между запросами.

export type AiTaskEvaluation = {
  text: string; // краткое название действия
  resultText: string; // ожидаемый результат
  motivationText: string; // мотивация (контекст, не влияет на score)
  suggestedProjectId: string | null; // предположение ИИ, к какому проекту относится
  value: number; // Impact — ценность результата, 1-5
  costOfDelay: number; // цена откладывания, 1-5
  timeSensitivity: number; // временная чувствительность, 1-5
  goalAlignment: number; // связь с текущей целью, 1-5 (внутренний модификатор, не показывается пользователю)
  effortMinutes: number; // затраты в минутах
  alternativeQuality: number; // 0..1, есть ли равноценная альтернатива
  confidence: number; // 0..1, уверенность оценки
  confidenceReason: string; // короткое объяснение, чего не хватило для высокой уверенности
  deadline: string | null; // ISO-дата (YYYY-MM-DD) или null — жёсткий срок
  scheduledDate: string | null; // ISO-дата (YYYY-MM-DD) или null — на какой день пользователь ХОЧЕТ поставить задачу в план (не срок, а намерение)
  financialConsequence: boolean;
  primaryReason: string; // короткое объяснение приоритета — главная причина
  riskText: string; // риск отложить
  // Объяснение по каждому критерию отдельно — почему именно такая оценка у ЭТОЙ задачи.
  reasoningValue: string;
  reasoningCostOfDelay: string;
  reasoningTimeSensitivity: string;
  reasoningEffort: string;
};

export type ChatMessage = { role: "user" | "assistant"; text: string };

export type ChatResult =
  | { done: false; question: string }
  | { done: true; tasks: AiTaskEvaluation[] };

export type AiContext = {
  currentGoal?: string | null;
  today?: Date;
  projects?: { id: string; name: string }[];
};

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const EVALUATION_SCHEMA_OBJ = {
  type: "OBJECT",
  properties: {
    text: { type: "STRING" },
    resultText: { type: "STRING" },
    motivationText: { type: "STRING" },
    suggestedProjectId: { type: "STRING", nullable: true },
    value: { type: "INTEGER" },
    costOfDelay: { type: "INTEGER" },
    timeSensitivity: { type: "INTEGER" },
    goalAlignment: { type: "INTEGER" },
    effortMinutes: { type: "INTEGER" },
    alternativeQuality: { type: "NUMBER" },
    confidence: { type: "NUMBER" },
    confidenceReason: { type: "STRING" },
    deadline: { type: "STRING", nullable: true },
    scheduledDate: { type: "STRING", nullable: true },
    financialConsequence: { type: "BOOLEAN" },
    primaryReason: { type: "STRING" },
    riskText: { type: "STRING" },
    reasoningValue: { type: "STRING" },
    reasoningCostOfDelay: { type: "STRING" },
    reasoningTimeSensitivity: { type: "STRING" },
    reasoningEffort: { type: "STRING" },
  },
  required: [
    "text", "resultText", "motivationText", "suggestedProjectId", "value", "costOfDelay",
    "timeSensitivity", "goalAlignment", "effortMinutes", "alternativeQuality",
    "confidence", "confidenceReason", "deadline", "scheduledDate", "financialConsequence", "primaryReason", "riskText",
    "reasoningValue", "reasoningCostOfDelay", "reasoningTimeSensitivity", "reasoningEffort",
  ],
};

const CRITERIA_GUIDE = `Критерии, которые нужно оценить для каждой задачи (сам пользователь их не заполняет — ты оцениваешь по смыслу текста):

- text: краткое название действия, конкретно, через результат, а не процесс. Плохо: "поработать над отчётом". Хорошо: "отправить черновик отчёта руководителю".
- resultText: что станет возможным/готовым после выполнения.
- motivationText: зачем это нужно пользователю (эмоциональный контекст) — на оценки НЕ влияет, только для объяснения.
- suggestedProjectId: id проекта из списка ниже, к которому явно или по смыслу относится задача. Если явной связи нет — null. Не выдумывай id, которых нет в списке.
- value (1-5): Impact — ценность результата. 1 — почти ничего не меняет, 5 — критически важный результат.
- costOfDelay (1-5): Cost of Delay — что случится, если НЕ сделать сейчас. 1 — почти ничего, 5 — критическая потеря результата/денег/возможности. Учитывай в этом числе и то, насколько срочно/обязательно это по времени (отдельного критерия срочности нет — чтобы не считать один и тот же риск дважды).
- timeSensitivity (1-5): Time Sensitivity — как быстро падает ценность задачи при откладывании (вакансия «протухает» быстро — высокая; документация подождёт — низкая).
- goalAlignment (1-5): насколько задача связана с текущей главной целью пользователя (см. контекст ниже). Если цель не задана или связи не видно — 3.
- effortMinutes: Effort — сколько минут потребует задача. Это НЕ ценность и не должно само по себе снижать приоритет — только вспомогательный фактор при сравнении близких по важности задач. Если пользователь сам назвал время — используй его. Если нет — оцени по смыслу.
- alternativeQuality (0-1): есть ли равноценный способ получить тот же результат иначе. 0 — альтернативы нет, 1 — есть почти равноценная замена.
- confidence (0-1): твоя уверенность в оценке. Низкая (<0.5), если не хватает ключевой информации (особенно срок или объём задачи). Не выдумывай отсутствующие данные — если их нет, снижай confidence вместо того, чтобы гадать.
- confidenceReason: если confidence не высокая (<0.75) — одна короткая фраза, чего именно не хватило (например "Не указан точный дедлайн."). Если уверенность высокая — пустая строка.
- deadline: жёсткий срок в формате YYYY-MM-DD, если явно назван или однозначно следует из текста (например «до пятницы», «сегодня до 18:00» → дата сегодня). Это когда задачу НУЖНО закончить. Иначе null.
- scheduledDate: дата в формате YYYY-MM-DD, если пользователь явно сказал, на КАКОЙ ДЕНЬ поставить задачу в план — «добавь на завтра», «запланируй на пятницу», «на понедельник», «5 сентября». Это не срок, а желаемый день выполнения — переведи относительные слова («завтра», «в пятницу») в конкретную дату, используя сегодняшнюю дату из контекста ниже. Если пользователь не называл конкретный день — null (тогда пользователь сам решит, куда положить задачу).
- financialConsequence: true, если невыполнение напрямую задерживает или теряет деньги.
- primaryReason: одна короткая человеческая фраза — главная причина такого приоритета в целом (это покажется пользователю как объяснение рекомендации).
- riskText: одна короткая фраза — что теряется при откладывании.
- reasoningValue / reasoningCostOfDelay / reasoningTimeSensitivity / reasoningEffort:
  для КАЖДОГО из этих четырёх критериев — отдельная короткая фраза (не более одного предложения),
  объясняющая именно ЭТУ оценку у ЭТОЙ конкретной задачи. Не общее определение критерия
  (его пользователь и так увидит), а именно "почему у этой задачи такая цифра". Не выдумывай
  ложную точность ("потеряет 17% ценности") — если данных не хватает, пиши это как предположение
  и снижай confidence.

Явные словесные подсказки пользователя всегда приоритетнее твоей догадки по контексту:
"очень важно/критично" → value=5; "неважно" → value=1
"нельзя пропустить/пропущу возможность/срочно/горит" → costOfDelay=5; "подождёт/не горит" → costOfDelay=1
явно названное время ("минут 15", "часа два") → используй как effortMinutes`;

function contextBlock(context?: AiContext) {
  const today = context?.today ?? new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const goalLine = context?.currentGoal
    ? `Текущая главная цель пользователя: "${context.currentGoal}".`
    : "Текущая цель не задана — используй goalAlignment = 3 для всех задач, если явной связи не видно.";
  const projects = context?.projects ?? [];
  const projectsLine = projects.length
    ? `Существующие проекты (id — название):\n${projects.map((p) => `${p.id} — ${p.name}`).join("\n")}`
    : "Проектов пока нет — suggestedProjectId всегда null.";
  return `Контекст:\nСегодняшняя дата: ${dateStr}.\n${goalLine}\n\n${projectsLine}`;
}

function clampNum(n: unknown, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function normalizeEvaluation(raw: unknown, validProjectIds: Set<string>): AiTaskEvaluation | null {
  if (typeof raw !== "object" || raw === null) return null;
  const t = raw as Record<string, unknown>;
  const text = String(t.text ?? "").trim();
  if (!text) return null;

  let deadline: string | null = null;
  if (typeof t.deadline === "string" && /^\d{4}-\d{2}-\d{2}/.test(t.deadline)) {
    deadline = t.deadline.slice(0, 10);
  }

  let scheduledDate: string | null = null;
  if (typeof t.scheduledDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(t.scheduledDate)) {
    scheduledDate = t.scheduledDate.slice(0, 10);
  }

  const suggestedProjectId =
    typeof t.suggestedProjectId === "string" && validProjectIds.has(t.suggestedProjectId)
      ? t.suggestedProjectId
      : null;

  return {
    text,
    resultText: String(t.resultText ?? "").trim(),
    motivationText: String(t.motivationText ?? "").trim(),
    suggestedProjectId,
    value: clampNum(t.value, 1, 5, 3),
    costOfDelay: clampNum(t.costOfDelay, 1, 5, 3),
    timeSensitivity: clampNum(t.timeSensitivity, 1, 5, 3),
    goalAlignment: clampNum(t.goalAlignment, 1, 5, 3),
    effortMinutes: Math.round(clampNum(t.effortMinutes, 5, 60 * 24 * 14, 30)),
    alternativeQuality: clampNum(t.alternativeQuality, 0, 1, 0),
    confidence: clampNum(t.confidence, 0, 1, 0.5),
    confidenceReason: String(t.confidenceReason ?? "").trim(),
    deadline,
    scheduledDate,
    financialConsequence: Boolean(t.financialConsequence),
    primaryReason: String(t.primaryReason ?? "").trim(),
    riskText: String(t.riskText ?? "").trim(),
    reasoningValue: String(t.reasoningValue ?? "").trim(),
    reasoningCostOfDelay: String(t.reasoningCostOfDelay ?? "").trim(),
    reasoningTimeSensitivity: String(t.reasoningTimeSensitivity ?? "").trim(),
    reasoningEffort: String(t.reasoningEffort ?? "").trim(),
  };
}

function requireApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Не настроен ключ Gemini. Добавьте GEMINI_API_KEY в файл .env и перезапустите сервер."
    );
  }
  return apiKey;
}

async function callGemini(prompt: string, responseSchema: object) {
  const apiKey = requireApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API вернул ошибку (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini не вернул ответ. Попробуйте ещё раз.");

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Не удалось разобрать ответ ИИ. Попробуйте ещё раз.");
  }
}

// ---------- Единая точка входа: и разбор, и уточняющий диалог ----------
// Первый вызов идёт с history=[] — если этого достаточно, done=true сразу,
// без отдельного "режима". Если не хватает данных — done=false с одним вопросом,
// следующий вызов передаёт этот же history + ответ пользователя.

export async function chatWithAI(
  history: ChatMessage[],
  newMessage: string,
  context?: AiContext
): Promise<ChatResult> {
  const transcript = [...history, { role: "user" as const, text: newMessage }]
    .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.text}`)
    .join("\n");

  const prompt = `Ты — ассистент, который помогает пользователю занести задачи в личный трекер дел. Отвечай по-русски коротко и по-человечески.

${contextBlock(context)}

${CRITERIA_GUIDE}

Правила:
1. Не додумывай сам, если формулировка расплывчата (например "поработать над проектом") — уточни, какой именно результат нужен.
2. Если пользователь одним сообщением описал несколько разных задач ("проверить рекламу и выставить счета") — раздели их на отдельные объекты в tasks, у каждой свои criteria.
3. Если для какой-то задачи не хватает информации, которая ЗНАЧИМО повлияла бы на приоритет (особенно срок или объём работы), задай ОДИН короткий уточняющий вопрос за раз — не вываливай сразу несколько. Если оценку можно разумно сделать и без уточнения — не спрашивай.
4. Как только по всем упомянутым задачам можно дать оценку со сносной уверенностью — заверши разговор и верни финальный список.

Отвечай СТРОГО JSON-объектом:
{"done": boolean, "question": string, "tasks": [оценки задач по схеме выше]}

Если разговор не закончен: done=false, question — вопрос, tasks — пустой массив.
Если закончен: done=true, question — пустая строка, tasks — финальный список.

Переписка (последнее сообщение — самое новое):
---
${transcript}
---`;

  const parsed = await callGemini(prompt, {
    type: "OBJECT",
    properties: {
      done: { type: "BOOLEAN" },
      question: { type: "STRING" },
      tasks: { type: "ARRAY", items: EVALUATION_SCHEMA_OBJ },
    },
    required: ["done", "question", "tasks"],
  });

  const validProjectIds = new Set((context?.projects ?? []).map((p) => p.id));

  if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).done === true) {
    const tasks = Array.isArray((parsed as Record<string, unknown>).tasks)
      ? ((parsed as Record<string, unknown>).tasks as unknown[])
          .map((t) => normalizeEvaluation(t, validProjectIds))
          .filter((t): t is AiTaskEvaluation => t !== null)
      : [];
    if (tasks.length === 0) {
      return { done: false, question: "Расскажите подробнее, какую задачу нужно добавить?" };
    }
    return { done: true, tasks };
  }

  const question = String((parsed as Record<string, unknown>)?.question ?? "").trim();
  return { done: false, question: question || "Расскажите подробнее об этой задаче?" };
}
