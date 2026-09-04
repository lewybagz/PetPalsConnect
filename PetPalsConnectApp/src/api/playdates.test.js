import api from "./axios";
import {
  acceptPlaydate,
  cancelPlaydate,
  combineDateAndTime,
  createPlaydate,
  declinePlaydate,
  describePlaydateStatus,
  fetchLocation,
  fetchMatchedPets,
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

describe("the pets you can invite", () => {
  const bo = { _id: "bo", name: "Bo", photos: ["bo.jpg"] };
  const sky = { _id: "sky", name: "Sky" };

  it("returns the other side of each match, not the match row", async () => {
    // `/matched-pets` returns PetMatch documents. Rendering one as a pet is
    // why the picker was a column of cards with no name and no photo.
    api.get.mockResolvedValue({
      data: [
        { _id: "m1", matchScore: 88, pet1: "mine", pet2: bo },
        { _id: "m2", matchScore: 71, pet1: "mine", pet2: sky },
      ],
    });

    expect(await fetchMatchedPets()).toEqual([bo, sky]);
  });

  it("shows a pet once, however many of your pets it matched", async () => {
    api.get.mockResolvedValue({
      data: [
        { _id: "m1", pet1: "mine", pet2: bo },
        { _id: "m2", pet1: "my-other", pet2: bo },
      ],
    });

    expect(await fetchMatchedPets()).toEqual([bo]);
  });

  it("skips a match whose pet has been deleted since", async () => {
    api.get.mockResolvedValue({ data: [{ _id: "m1", pet2: null }, { _id: "m2", pet2: bo }] });

    expect(await fetchMatchedPets()).toEqual([bo]);
  });

  it("returns nothing rather than throwing on an unexpected body", async () => {
    api.get.mockResolvedValue({ data: { message: "nope" } });

    expect(await fetchMatchedPets()).toEqual([]);
  });
});

describe("one place by id", () => {
  it("asks for the place the caller already chose", async () => {
    const park = { _id: "loc-9", name: "Far Away Field" };
    api.get.mockResolvedValue({ data: park });

    expect(await fetchLocation("loc-9")).toEqual(park);
    expect(api.get).toHaveBeenCalledWith("/api/locations/loc-9");
  });

  it("gives back null rather than undefined when there is no body", async () => {
    api.get.mockResolvedValue({});

    expect(await fetchLocation("loc-9")).toBeNull();
  });
});
