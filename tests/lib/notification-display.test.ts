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

  it("badge: a data.badgeKey alapján i18n-kulcsot képez", () => {
    expect(
      notificationContent(
        { type: "badge", title: null, body: null, data: { badgeKey: "roundWinner", count: 3 } },
        t,
      ),
    ).toEqual({ title: "badge.roundWinner.title", body: "badge.roundWinner.body" });
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
