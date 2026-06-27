import { describe, expect, it } from "vitest";
import { formatRelativeTime, notificationContent } from "@/lib/notification-display";

// Mock fordító: a kulcsot + a count paramétert adja vissza determinisztikusan.
const t = (key: string, values?: Record<string, string | number>) =>
  values && "count" in values ? `${key}:${values.count}` : key;

describe("notificationContent", () => {
  it("system: a tárolt title/body-t adja vissza", () => {
    expect(
      notificationContent(
        { type: "system", title: "Új funkció", body: "Próbáld ki!", data: null },
        t,
      ),
    ).toEqual({ title: "Új funkció", body: "Próbáld ki!" });
  });

  it("system: null mezőkből üres stringet ad", () => {
    expect(notificationContent({ type: "system", title: null, body: null, data: null }, t)).toEqual(
      {
        title: "",
        body: "",
      },
    );
  });

  it("badge: a data.badgeKey alapján i18n-kulcsot képez (count interpoláció)", () => {
    expect(
      notificationContent(
        {
          type: "badge",
          title: null,
          body: null,
          data: { badgeKey: "round_winner", count: 3, tier: 2 },
        },
        t,
      ),
    ).toEqual({ title: "badge.round_winner.title", body: "badge.round_winner.body:3" });
  });

  it("badge: hiányzó count esetén 0-t használ", () => {
    expect(
      notificationContent(
        { type: "badge", title: null, body: null, data: { badgeKey: "win_streak" } },
        t,
      ),
    ).toEqual({ title: "badge.win_streak.title", body: "badge.win_streak.body:0" });
  });

  it("badge: aggregált értesítés", () => {
    expect(
      notificationContent(
        { type: "badge", title: null, body: null, data: { aggregate: true, count: 4 } },
        t,
      ),
    ).toEqual({ title: "badge.aggregate.title", body: "badge.aggregate.body:4" });
  });

  it("badge: aggregált értesítés hiányzó count → 0", () => {
    expect(
      notificationContent({ type: "badge", title: null, body: null, data: { aggregate: true } }, t),
    ).toEqual({ title: "badge.aggregate.title", body: "badge.aggregate.body:0" });
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-06-24T12:00:00Z");
  it("60 mp alatt: 'most'", () => {
    expect(formatRelativeTime(new Date("2026-06-24T11:59:30Z"), now, t)).toBe("time.now");
  });
  it("percek", () => {
    expect(formatRelativeTime(new Date("2026-06-24T11:45:00Z"), now, t)).toBe("time.minutes:15");
  });
  it("órák", () => {
    expect(formatRelativeTime(new Date("2026-06-24T09:00:00Z"), now, t)).toBe("time.hours:3");
  });
  it("napok", () => {
    expect(formatRelativeTime(new Date("2026-06-22T12:00:00Z"), now, t)).toBe("time.days:2");
  });
});
