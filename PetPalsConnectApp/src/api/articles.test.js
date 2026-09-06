import { orderTopics, topicLabel, SPECIES_TAGS } from "./articles";

/**
 * The two pure pieces of the articles module.
 *
 * Ordering and labelling are the parts a screenshot cannot check and a render
 * test would only check incidentally, and they are the parts that decide
 * whether the browse row reads as a considered index or as an alphabetical
 * dump of whatever tags happened to be written.
 */
describe("orderTopics", () => {
  it("puts species first, in the declared order", () => {
    const ordered = orderTopics([
      { tag: "safety", count: 40 },
      { tag: "cats", count: 3 },
      { tag: "dogs", count: 5 },
    ]);
    expect(ordered.map((t) => t.tag)).toEqual(["dogs", "cats", "safety"]);
  });

  it("orders the rest by count, then alphabetically", () => {
    const ordered = orderTopics([
      { tag: "training", count: 2 },
      { tag: "health", count: 9 },
      { tag: "behaviour", count: 2 },
    ]);
    expect(ordered.map((t) => t.tag)).toEqual(["health", "behaviour", "training"]);
  });

  it("does not mutate its argument", () => {
    const topics = [{ tag: "safety", count: 1 }, { tag: "dogs", count: 1 }];
    orderTopics(topics);
    expect(topics[0].tag).toBe("safety");
  });

  it("keeps every species tag it knows about distinct", () => {
    expect(new Set(SPECIES_TAGS).size).toBe(SPECIES_TAGS.length);
  });
});

describe("topicLabel", () => {
  it("un-hyphenates and sentence-cases", () => {
    expect(topicLabel("guinea-pigs")).toBe("Guinea pigs");
    expect(topicLabel("dogs")).toBe("Dogs");
    expect(topicLabel("end-of-life")).toBe("End of life");
  });

  it("survives a missing tag rather than throwing", () => {
    expect(topicLabel(undefined)).toBe("");
  });
});
