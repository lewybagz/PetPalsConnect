import api from "./axios";
import {
  acceptPlaydate,
  cancelPlaydate,
  combineDateAndTime,
  createPlaydate,
  declinePlaydate,
  describePlaydateStatus,
  fetchNearbyLocations,
  fetchUpcomingPlaydates,
} from "./playdates";

jest.mock("./axios", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  api.post.mockResolvedValue({ data: {} });
  api.patch.mockResolvedValue({ data: {} });
  api.get.mockResolvedValue({ data: [] });
});

describe("creating a playdate", () => {
  const date = new Date("2026-05-01T09:00:00.000Z");
  const time = new Date("2026-05-01T16:30:00.000Z");

  it("sends lowercase fields the schema actually has", async () => {
    await createPlaydate({
      date,
      time,
      locationId: "loc-1",
      petIds: ["mine", "theirs"],
      notes: "Bring a ball",
    });

    const [, body] = api.post.mock.calls[0];
    // `Date`/`Location`/`Creator` are dropped by strict mode, which is why
    // every create used to fail validation.
    expect(Object.keys(body).sort()).toEqual([
      "date",
      "location",
      "notes",
      "petsInvolved",
      "startTime",
    ]);
  });

  it("always sends startTime, which the schema requires", async () => {
    await createPlaydate({ date, locationId: "loc-1", petIds: ["mine"] });

    const [, body] = api.post.mock.calls[0];
    expect(body.startTime).toBeTruthy();
  });

  it("never sends the organiser - the server takes it from the token", async () => {
    await createPlaydate({ date, time, locationId: "loc-1", petIds: ["mine"] });

    const [, body] = api.post.mock.calls[0];
    expect(body.creator).toBeUndefined();
    expect(body.participants).toBeUndefined();
  });

  it("keeps the time from the time picker", () => {
    // Both pickers exist on the form; only the date used to be sent, so a 4pm
    // playdate was stored at whatever hour the date picker carried.
    const combined = combineDateAndTime(date, time);

    expect(combined.getHours()).toBe(time.getHours());
    expect(combined.getMinutes()).toBe(time.getMinutes());
    expect(combined.getDate()).toBe(date.getDate());
  });
});

describe("locations", () => {
  it("asks the locations mount, not the playdates one", async () => {
    await fetchNearbyLocations({ latitude: 1, longitude: 2, range: 10 });

    // /api/playdates/playdate-locations matched `/api/playdates/:id` and asked
    // for a playdate whose id is the string "playdate-locations".
    expect(api.get).toHaveBeenCalledWith("/api/locations/playdate-locations", {
      params: { userLat: 1, userLng: 2, range: 10 },
    });
  });

  it("still asks when the user declined location permission", async () => {
    await fetchNearbyLocations({ range: 10 });

    expect(api.get).toHaveBeenCalledWith("/api/locations/playdate-locations", {
      params: undefined,
    });
  });

  it("returns an array whatever the server sends", async () => {
    api.get.mockResolvedValue({ data: null });
    expect(await fetchNearbyLocations({})).toEqual([]);
  });
});

describe("answering", () => {
  it("accepts, declines and cancels through the endpoints that exist", async () => {
    await acceptPlaydate("pd-1");
    await declinePlaydate("pd-1");
    await cancelPlaydate("pd-1", "Rained off");

    expect(api.post).toHaveBeenNthCalledWith(1, "/api/playdates/accept/pd-1");
    expect(api.post).toHaveBeenNthCalledWith(2, "/api/playdates/decline/pd-1");
    expect(api.patch).toHaveBeenCalledWith("/api/playdates/pd-1/cancel", {
      message: "Rained off",
    });
  });

  it("returns an array from upcoming even when the server sends something else", async () => {
    api.get.mockResolvedValue({ data: null });
    expect(await fetchUpcomingPlaydates()).toEqual([]);
  });
});

describe("status wording", () => {
  it("explains what pending means to a person", () => {
    expect(describePlaydateStatus("pending")).toBe("Waiting for a reply");
  });

  it("falls back to the raw status for anything unrecognised", () => {
    expect(describePlaydateStatus("rescheduled")).toBe("rescheduled");
  });
});
