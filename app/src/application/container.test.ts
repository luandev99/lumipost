import { describe, expect, it, vi } from "vitest";
import { ApplicationContainer } from "./container";

describe("ApplicationContainer", () => {
  it("autentica as contas seed e rejeita credenciais inválidas", async () => {
    const app = new ApplicationContainer();
    await expect(
      app.login("demo@lumipost.ai", "Lumipost123!"),
    ).resolves.toMatchObject({ user: { role: "user" } });
    await expect(app.login("demo@lumipost.ai", "senha-errada")).rejects.toThrow(
      "Email ou senha incorretos",
    );
  });

  it("sugere exatamente cinco slots com custo coerente", () => {
    const slots = new ApplicationContainer().suggestWeek("2030-05-06");
    expect(slots).toHaveLength(5);
    expect(slots.find((slot) => slot.format === "carousel")?.cost).toBe(25);
    expect(new Set(slots.map((slot) => `${slot.date}T${slot.time}`)).size).toBe(
      5,
    );
  });

  it("bloqueia mais de cinco conteúdos no mesmo dia", async () => {
    const app = new ApplicationContainer();
    const slot = { ...app.suggestWeek("2030-05-06")[0], quantity: 6 };
    await expect(
      app.confirmWeek("demo-user", "2030-05-06", [slot]),
    ).rejects.toThrow("entre 1 e 5 conteúdos");
  });

  it("bloqueia conflitos exatos de data e horário", async () => {
    const app = new ApplicationContainer();
    const slots = app.suggestWeek("2030-05-06").slice(0, 2);
    slots[1] = { ...slots[1], date: slots[0].date, time: slots[0].time };
    await expect(
      app.confirmWeek("demo-user", "2030-05-06", slots),
    ).rejects.toThrow("mesmo dia e horário");
  });

  it("gera cinco conteúdos com horários distintos para um dia selecionado", async () => {
    const app = new ApplicationContainer();
    vi.spyOn(app.templates, "list").mockResolvedValue([]);
    const slot = {
      ...app.suggestWeek("2030-05-06")[0],
      time: "09:00",
      quantity: 5,
    };
    const result = await app.confirmWeek("demo-user", "2030-05-06", [slot]);
    const generated = result.queue.filter((item) =>
      item.scheduledAt.startsWith(slot.date),
    );
    expect(generated).toHaveLength(5);
    expect(new Set(generated.map((item) => item.scheduledAt)).size).toBe(5);
  });

  it("cobra dois créditos pelo agendamento manual e permite recarga adicional", async () => {
    const app = new ApplicationContainer();
    const user = await app.register({
      name: "Teste de créditos",
      email: `creditos-${Date.now()}@teste.com`,
      password: "Senha123!",
    });
    await app.subscribe(user.id, "month");
    const content = await app.createContent({
      userId: user.id,
      title: "Publicação manual",
      format: "post",
      source: "manual",
    });
    const scheduled = await app.scheduleContent(
      user.id,
      content.id,
      "2035-06-10T19:30:00.000Z",
    );
    expect(scheduled.chargedCredits).toBe(2);
    expect(scheduled.subscription?.credits).toBe(118);
    const recharged = await app.purchaseCredits(user.id, "boost-50");
    expect(recharged.credits).toBe(168);
  });
});
