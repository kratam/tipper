import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retryingFetch } from "./db-retry-fetch";

const URL = "https://example.neon.tech/sql";

function retryable500(): Response {
  return new Response(
    JSON.stringify({ message: "Control plane request failed", "neon:retryable": true }),
    { status: 500 },
  );
}

function plain500(): Response {
  return new Response(JSON.stringify({ message: "boom" }), { status: 500 });
}

describe("retryingFetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns the response immediately on success and calls fetch once", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await retryingFetch(URL, { method: "POST" });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not consume the body on the happy path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("payload", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await retryingFetch(URL);

    expect(await res.text()).toBe("payload");
  });

  it("retries a neon:retryable 500 and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(retryable500())
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = retryingFetch(URL);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a 500 without the retryable flag", async () => {
    const fetchMock = vi.fn().mockResolvedValue(plain500());
    vi.stubGlobal("fetch", fetchMock);

    const res = await retryingFetch(URL);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "boom" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries when fetch throws a network error, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = retryingFetch(URL);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exhausts attempts on a persistent retryable 500 and returns the last response", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(retryable500()));
    vi.stubGlobal("fetch", fetchMock);

    const promise = retryingFetch(URL);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("rethrows when fetch keeps throwing past the attempt limit", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const promise = retryingFetch(URL);
    const assertion = expect(promise).rejects.toThrow("network down");
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
