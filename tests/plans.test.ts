import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, mockFetch } from "./setup";

describe("Plans", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = mockFetch({ token: "test_bearer" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls create with correct URL", async () => {
    const client = createTestClient();
    await client.plans.create({
      id_plan: "coursereact",
      name: "Course react js",
      description: "Course react and redux",
      amount: 30000,
      currency: "cop",
      interval: "month",
      interval_count: 1,
      trial_days: 30,
    });

    const calls = fetchMock.mock.calls;
    const createCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" && c[0].includes("/recurring/v1/plan/create"),
    );
    expect(createCall).toBeDefined();
  });

  it("calls get with uid", async () => {
    const client = createTestClient();
    await client.plans.get("plan_123");

    const calls = fetchMock.mock.calls;
    const getCall = calls.find(
      (c: unknown[]) => typeof c[0] === "string" && c[0].includes("plan_123"),
    );
    expect(getCall).toBeDefined();
  });

  it("calls list", async () => {
    const client = createTestClient();
    await client.plans.list();

    const calls = fetchMock.mock.calls;
    const listCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" && c[0].includes("/recurring/v1/plans/"),
    );
    expect(listCall).toBeDefined();
  });

  it("calls delete with uid", async () => {
    const client = createTestClient();
    await client.plans.delete("plan_123");

    const calls = fetchMock.mock.calls;
    const deleteCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === "string" && c[0].includes("/recurring/v1/plan/remove/"),
    );
    expect(deleteCall).toBeDefined();
  });
});
