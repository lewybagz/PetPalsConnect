import { TYPES, destinationFor, normaliseType } from "./notifications";
import { routeForNotification } from "../hooks/usePushNotifications";

/**
 * Where a notification goes when somebody taps it.
 *
 * There were two tables. `usePushNotifications` had one written against the
 * push payloads, and the list screen had none at all - it rendered `content`
 * and nothing else. So the same event routed one way from a lock screen and
 * nowhere from the list, and `petMatch` - the one push both people are waiting
 * on - was in neither, falling through to `default` and doing nothing.
 */

describe("notification destinations", () => {
  it("every type names a screen", () => {
    for (const [name, entry] of Object.entries(TYPES)) {
      expect(entry.screen).toBeTruthy();
      expect(typeof entry.screen).toBe("string");
      expect(name).toBe(name.trim());
    }
  });

  it("a match opens the pet it matched with", () => {
    expect(destinationFor({ type: "petMatch", petId: "pet-1" })).toEqual([
      "PetDetails",
      { petId: "pet-1" },
    ]);
  });

  it("a message opens that conversation", () => {
    expect(destinationFor({ type: "message", chatId: "chat-1" })).toEqual([
      "Chat",
      { chatId: "chat-1" },
    ]);
  });

  it("a group message opens the group, not the one-to-one screen", () => {
    // The push carried `type: "message"`, which routes to Chat - so a group
    // message opened the wrong conversation.
    expect(destinationFor({ type: "groupMessage", chatId: "g1" })).toEqual([
      "GroupChat",
      { chatId: "g1" },
    ]);
  });

  it("a param the destination does not read is dropped", () => {
    expect(destinationFor({ type: "petMatch", chatId: "chat-1" })).toEqual([
      "PetDetails",
      {},
    ]);
  });

  it("reads a push payload's data as readily as a stored row", () => {
    expect(
      destinationFor({ data: { type: "playdate", playdateId: "p1" } })
    ).toEqual(["PlaydateDetails", { playdateId: "p1" }]);
  });

  it("values written before the table existed still resolve", () => {
    expect(normaliseType("DirectMessage")).toBe("message");
    expect(normaliseType("Playdate Cancelled")).toBe("playdateCancelled");
    expect(normaliseType("PetMatch")).toBe("petMatch");
  });

  it("something unrecognised goes to the list rather than nowhere", () => {
    expect(destinationFor({ type: "a type we stopped sending" })).toEqual([
      "Notifications",
      {},
    ]);
    expect(destinationFor({})).toEqual(["Notifications", {}]);
  });

  it("the push handler and the list agree, because they share the table", () => {
    const message = { data: { type: "petMatch", petId: "pet-7" } };
    expect(routeForNotification(message)).toEqual(destinationFor(message.data));
  });
});
