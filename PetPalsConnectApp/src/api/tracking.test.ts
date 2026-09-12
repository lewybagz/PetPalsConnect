import { describe, expect, it, jest, beforeEach } from "@jest/globals";

import api from "./axios";
import {
  describeLastSeen,
  describeUntil,
  fetchPetPositions,
  fetchTrackedCollars,
  fetchTrackingStatus,
  isStale,
  sharePet,
} from "./tracking";

jest.mock("./axios", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() }));

type ApiMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
const mockedApi = api as unknown as { get: ApiMock; post: ApiMock };

/**
 * The tracking client. What matters: "off" and "not yours" are quiet
 * answers, not thrown ones; a share names the friend and the hours and
 * nothing else; and the age of a position reads as words.
 */
describe("tracking api", () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
  });

  it("a server with tracking off reads as disabled, not as an error", async () => {
    mockedApi.get.mockRejectedValue({ response: { status: 503 } });
    expect(await fetchTrackingStatus()).toEqual({ enabled: false, vendor: null, acceptsIngest: false });
    expect(await fetchTrackedCollars()).toEqual([]);
  });

  it("a pet the caller may not see is null; anything else still throws", async () => {
    mockedApi.get.mockRejectedValue({ response: { status: 404 } });
    expect(await fetchPetPositions("p1")).toBeNull();

    mockedApi.get.mockRejectedValue({ response: { status: 500 } });
    await expect(fetchPetPositions("p1")).rejects.toBeTruthy();
  });

  it("sharing sends the viewer and the hours under the pet", async () => {
    mockedApi.post.mockResolvedValue({ data: { _id: "s1" } });
    await sharePet("p1", "u2", 4);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/tracking/pets/p1/shares", { viewer: "u2", hours: 4 });
  });

  it("describes how old a position is", () => {
    const now = Date.parse("2026-09-11T12:00:00Z");
    const at = (msAgo: number) => new Date(now - msAgo).toISOString();

    expect(describeLastSeen(null, now)).toBe("No position yet");
    expect(describeLastSeen(at(10_000), now)).toBe("Just now");
    expect(describeLastSeen(at(60_000), now)).toBe("1 minute ago");
    expect(describeLastSeen(at(4 * 60_000), now)).toBe("4 minutes ago");
    expect(describeLastSeen(at(2 * 3_600_000), now)).toBe("2 hours ago");
    expect(describeLastSeen(at(3 * 86_400_000), now)).toBe("3 days ago");
    expect(describeLastSeen("garbage", now)).toBe("No position yet");
  });

  it("calls a position stale after ten minutes", () => {
    const now = Date.parse("2026-09-11T12:00:00Z");
    expect(isStale(new Date(now - 60_000).toISOString(), now)).toBe(false);
    expect(isStale(new Date(now - 11 * 60_000).toISOString(), now)).toBe(true);
    expect(isStale(null, now)).toBe(true);
  });

  it("says until when a share runs", () => {
    const now = Date.parse("2026-09-11T12:00:00");
    expect(describeUntil(new Date(now + 3_600_000).toISOString(), now)).toMatch(/^Until \d/);
    expect(describeUntil(new Date(now + 3 * 86_400_000).toISOString(), now)).toMatch(/^Until \w{3} \d/);
    expect(describeUntil("garbage", now)).toBe("");
  });
});
