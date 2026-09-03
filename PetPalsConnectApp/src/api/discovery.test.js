import api from "./axios";
import {
  MATCH_WEIGHTS,
  decide,
  describeScore,
  fetchCandidates,
  fetchMatches,
  topReasons,
} from "./discovery";

jest.mock("./axios", () => ({ get: jest.fn(), post: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe("fetching candidates", () => {
  it("browses as the caller's first pet by default", async () => {
    api.get.mockResolvedValue({ data: { pet: null, candidates: [], threshold: 45 } });

    await fetchCandidates();

    expect(api.get).toHaveBeenCalledWith("/api/petmatches/discover", {
      params: undefined,
    });
  });

  it("browses as a specific pet when asked", async () => {
    api.get.mockResolvedValue({ data: { candidates: [] } });

    await fetchCandidates("pet-1");

    expect(api.get).toHaveBeenCalledWith("/api/petmatches/discover", {
      params: { petId: "pet-1" },
    });
  });

  it("survives a response with no candidates array", async () => {
    api.get.mockResolvedValue({ data: {} });

    const result = await fetchCandidates();

    expect(result.candidates).toEqual([]);
    expect(result.pet).toBeNull();
  });
});

describe("deciding", () => {
  it("sends the pair and the verdict", async () => {
    api.post.mockResolvedValue({ data: { mutual: false } });

    await decide({ fromPetId: "a", toPetId: "b", decision: "like" });

    expect(api.post).toHaveBeenCalledWith("/api/petmatches/decide", {
      fromPetId: "a",
      toPetId: "b",
      decision: "like",
    });
  });

  it("returns an array from matches even when the server sends something else", async () => {
    api.get.mockResolvedValue({ data: null });
    expect(await fetchMatches()).toEqual([]);
  });
});

describe("describing a score", () => {
  it("calls a strong score a great match", () => {
    expect(describeScore(85, 45)).toBe("Great match");
  });

  it("calls anything above the threshold a good match", () => {
    expect(describeScore(50, 45)).toBe("Good match");
  });

  it("never dismisses a candidate outright", () => {
    // Below the threshold is still shown - it just is not oversold.
    expect(describeScore(20, 45)).toBe("Worth a look");
  });
});

describe("reasons", () => {
  /**
   * The server's breakdown is in weighted points, not ratios: a perfect
   * temperament match contributes 30 and a perfect age match 8. Comparing raw
   * numbers would rank "perfect on age" below "mediocre on temperament".
   */
  it("scales each dimension by its own weight", () => {
    const reasons = topReasons({
      temperament: 18, // 0.60 of 30 - just qualifies
      age: 8, // a perfect 8 of 8
      size: 5, // 0.20 of 25
    });

    expect(reasons[0]).toBe("Close in age");
  });

  it("leaves out dimensions the pets do not share", () => {
    expect(topReasons({ temperament: 3, size: 2, activities: 1 })).toEqual([]);
  });

  it("shows at most two", () => {
    const perfect = Object.fromEntries(
      Object.entries(MATCH_WEIGHTS).map(([key, weight]) => [key, weight])
    );
    expect(topReasons(perfect)).toHaveLength(2);
  });

  it("handles a missing breakdown", () => {
    expect(topReasons(undefined)).toEqual([]);
  });
});
