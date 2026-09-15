import api from "./axios";
import { readCache, writeCache } from "../services/localCache";
import { fetchHelp, groupByTopic } from "./help";

jest.mock("./axios", () => ({ get: jest.fn() }));
jest.mock("../services/localCache", () => ({ readCache: jest.fn(), writeCache: jest.fn() }));

const table = {
  topics: { discover: "Finding pals", spot: "Spot", empty: "Nothing here" },
  entries: [
    { id: "a", topic: "spot", question: "Q?", answer: "A.", screen: "Spot" },
    { id: "b", topic: "discover", question: "Q2?", answer: "A2.", screen: null },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  readCache.mockResolvedValue(null);
  writeCache.mockResolvedValue(undefined);
});

test("a good answer is cached and returned fresh", async () => {
  api.get.mockResolvedValue({ data: table });
  await expect(fetchHelp()).resolves.toEqual({ ...table, stale: false });
  expect(writeCache).toHaveBeenCalledWith("help-table-v1", table);
});

test("an empty answer never replaces a good cached copy, and a failure falls back to it", async () => {
  readCache.mockResolvedValue(table);
  api.get.mockResolvedValue({ data: { topics: {}, entries: [] } });
  await expect(fetchHelp()).resolves.toEqual({ ...table, stale: true });
  expect(writeCache).not.toHaveBeenCalled();

  api.get.mockRejectedValue(new Error("offline"));
  await expect(fetchHelp()).resolves.toEqual({ ...table, stale: true });

  readCache.mockResolvedValue(null);
  await expect(fetchHelp()).resolves.toEqual({ topics: {}, entries: [], stale: true });
});

test("grouping follows the table's topic order and drops an empty topic", () => {
  expect(groupByTopic(table).map((group) => [group.key, group.entries.map((e) => e.id)])).toEqual([
    ["discover", ["b"]],
    ["spot", ["a"]],
  ]);
});
