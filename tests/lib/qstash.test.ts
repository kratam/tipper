import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCallbackBaseUrl } from "@/lib/qstash";

const ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_ENV",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

describe("getCallbackBaseUrl", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });

  it("prefers NEXT_PUBLIC_APP_URL over every Vercel-provided variable", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://tippcasino.example.com";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "tippcasino.vercel.app";
    process.env.VERCEL_URL = "tipper-abc123-guestguru.vercel.app";

    expect(getCallbackBaseUrl()).toBe("https://tippcasino.example.com");
  });

  it("uses VERCEL_PROJECT_PRODUCTION_URL on production (not the stale deployment URL)", () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "tippcasino.vercel.app";
    process.env.VERCEL_URL = "tipper-abc123-guestguru.vercel.app";

    expect(getCallbackBaseUrl()).toBe("https://tippcasino.vercel.app");
  });

  it("falls back to deployment-specific VERCEL_URL on preview deployments", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "tippcasino.vercel.app";
    process.env.VERCEL_URL = "tipper-pr-42-guestguru.vercel.app";

    expect(getCallbackBaseUrl()).toBe("https://tipper-pr-42-guestguru.vercel.app");
  });

  it("returns localhost when no Vercel envs are set", () => {
    expect(getCallbackBaseUrl()).toBe("http://localhost:3000");
  });
});
