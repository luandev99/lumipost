import { z } from "npm:zod@3.24.2";
import { authenticate, requirePost } from "../_shared/auth.ts";
import {
  errorResponse,
  HttpError,
  json,
  preflight,
  traceIdFor,
} from "../_shared/http.ts";
import { generateWeeklyPlanWithOpenAI } from "../_shared/openai.ts";

const formatSchema = z.enum(["post", "carousel", "story", "reel"]);
const inputSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  selectedDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  formats: z.array(formatSchema).min(1).max(4),
  quantity: z.number().int().min(1).max(5),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  objective: z.string().trim().min(3).max(500),
  preferences: z.object({
    avoidRepeated: z.boolean(),
    varyTopics: z.boolean(),
    includeDates: z.boolean(),
    useProducts: z.boolean(),
    usePrevious: z.boolean(),
  }).strict(),
}).strict();

const dateForDay = (weekStart: string, dayIndex: number) => {
  const date = new Date(`${weekStart}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayIndex);
  return date.toISOString().slice(0, 10);
};

// America/Sao_Paulo não observa horário de verão desde 2019 — UTC-3 fixo.
// Mesma simplificação já usada no resto do app (timezone default hardcoded).
const BRAZIL_OFFSET_MS = -3 * 60 * 60 * 1000;
const nowInBrazil = () => new Date(Date.now() + BRAZIL_OFFSET_MS);
const todayInBrazil = () => nowInBrazil().toISOString().slice(0, 10);
const nowMinutesInBrazil = () => {
  const now = nowInBrazil();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
};

Deno.serve(async (request) => {
  const preflightResponse = preflight(request);
  if (preflightResponse) return preflightResponse;
  const traceId = traceIdFor(request);
  try {
    requirePost(request);
    const { client, user } = await authenticate(request);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(422, "INVALID_INPUT", "Revise os dados do planejamento.");

    const selectedDays = [...new Set(parsed.data.selectedDays)].sort((a, b) => a - b);
    const todayBrazil = todayInBrazil();
    if (
      selectedDays.some(
        (dayIndex) => dateForDay(parsed.data.weekStart, dayIndex) < todayBrazil,
      )
    )
      throw new HttpError(
        422,
        "PAST_DAY_SELECTED",
        "Um ou mais dias selecionados já passaram — atualize o planejamento.",
      );
    const workspace = await client.rpc("get_my_workspace");
    if (workspace.error || !workspace.data?.organization?.id)
      throw workspace.error ?? new Error("WORKSPACE_NOT_FOUND");
    const prompt = await client
      .from("prompt_templates")
      .select("system_prompt,user_prompt")
      .eq("task", "weekly-plan")
      .in("format", ["all"])
      .eq("status", "active")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prompt.error) throw prompt.error;
    const recent = parsed.data.preferences.usePrevious
      ? await client
        .from("contents")
        .select("title,topic,format")
        .order("created_at", { ascending: false })
        .limit(20)
      : { data: [], error: null };
    if (recent.error) throw recent.error;

    const generated = await generateWeeklyPlanWithOpenAI({
      userId: user.id,
      weekStart: parsed.data.weekStart,
      selectedDays,
      formats: parsed.data.formats,
      objective: parsed.data.objective,
      quantity: parsed.data.quantity,
      preferences: parsed.data.preferences,
      brand: workspace.data.brand ?? null,
      recentContents: recent.data ?? [],
      promptTemplate: prompt.data
        ? {
            systemPrompt: prompt.data.system_prompt,
            userPrompt: prompt.data.user_prompt,
          }
        : null,
    });

    // Um objeto por publicação (não por dia): quando publicationsPerDay > 1,
    // o mesmo dayIndex aparece repetido com temas distintos vindos da IA —
    // antes disso, o "dia" virava um único slot com quantity=N e o front
    // clonava o MESMO topic com sufixo "— ideia N", daí a repetição.
    const byDay = new Map<number, typeof generated.plan.slots>();
    for (const slot of generated.plan.slots) {
      const list = byDay.get(slot.dayIndex) ?? [];
      list.push(slot);
      byDay.set(slot.dayIndex, list);
    }
    if (
      selectedDays.some(
        (day) => (byDay.get(day)?.length ?? 0) !== parsed.data.quantity,
      )
    )
      throw new HttpError(
        502,
        "INVALID_AI_PLAN",
        "A IA não retornou a quantidade certa de publicações para cada dia.",
      );

    const minutesToTime = (totalMinutes: number) =>
      `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
    const scheduleTime = (baseMinutes: number, index: number) =>
      minutesToTime(Math.min(baseMinutes + index * 120, 23 * 60 + 59));
    const [preferredHour, preferredMinute] = parsed.data.preferredTime
      .split(":")
      .map(Number);
    const preferredMinutes = preferredHour * 60 + preferredMinute;
    // No dia de hoje, o primeiro horário nunca pode ficar no passado — usa
    // o maior entre o horário preferido e "agora + 1h" (mesma regra de
    // antecedência mínima já aplicada na hora de agendar de verdade).
    const nowMinutes = nowMinutesInBrazil();

    const slots = selectedDays.flatMap((dayIndex) => {
      const date = dateForDay(parsed.data.weekStart, dayIndex);
      const isToday = date === todayBrazil;
      const baseMinutes = isToday
        ? Math.max(preferredMinutes, nowMinutes + 60)
        : preferredMinutes;
      if (isToday && baseMinutes >= 23 * 60 + 59)
        throw new HttpError(
          422,
          "TODAY_HAS_NO_TIME_LEFT",
          "Não sobra horário útil hoje — desmarque o dia de hoje ou tente de novo amanhã.",
        );
      return byDay.get(dayIndex)!.map((slot, position) => {
        if (!parsed.data.formats.includes(slot.format))
          throw new HttpError(502, "INVALID_AI_FORMAT", "A IA retornou um formato não permitido.");
        const slides = slot.format === "carousel" ? 5 : 1;
        return {
          id: crypto.randomUUID(),
          format: slot.format,
          source: "ai",
          topic: slot.topic,
          date: dateForDay(parsed.data.weekStart, dayIndex),
          time: scheduleTime(baseMinutes, position),
          quantity: 1,
          slides,
          cost: 5 * slides,
        };
      });
    });
    return json(request, { slots, model: generated.model, traceId });
  } catch (error) {
    return errorResponse(request, error, traceId);
  }
});
