import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { Linking } from "react-native";

import api from "./axios";
import {
  describeItems,
  fetchOrderBySession,
  formatMinor,
  fromPrice,
  startCheckout,
} from "./store";
import type { Order, StoreProduct } from "../types/api";

jest.mock("./axios", () => ({ get: jest.fn(), post: jest.fn() }));

type ApiMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
const mockedApi = api as unknown as { get: ApiMock; post: ApiMock };

/**
 * The shop's client. Three rules worth a test each: checkout sends skus and
 * quantities and nothing that looks like a price; "not yet" from the order
 * lookup is null, not an exception; and money formats from minor units.
 */
describe("store api", () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  });

  it("checkout sends only sku and quantity, then opens the page Stripe returns", async () => {
    mockedApi.post.mockResolvedValue({
      data: { id: "cs_1", url: "https://checkout.stripe.test/cs_1" },
    });

    await startCheckout([{ sku: "tee-m", quantity: 2 }]);

    expect(mockedApi.post).toHaveBeenCalledWith("/api/store/checkout", {
      items: [{ sku: "tee-m", quantity: 2 }],
    });
    expect(JSON.stringify(mockedApi.post.mock.calls[0]?.[1])).not.toMatch(/amount|price/);
    expect(Linking.openURL).toHaveBeenCalledWith("https://checkout.stripe.test/cs_1");
  });

  it("does not open anything when the server returns no url", async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    await expect(startCheckout([{ sku: "tee-m", quantity: 1 }])).rejects.toThrow();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it("an order that has not landed yet is null, not an error", async () => {
    mockedApi.get.mockRejectedValue({ response: { status: 404 } });
    expect(await fetchOrderBySession("cs_1")).toBeNull();

    mockedApi.get.mockRejectedValue({ response: { status: 500 } });
    await expect(fetchOrderBySession("cs_1")).rejects.toBeTruthy();
  });

  it("formats minor units as currency", () => {
    expect(formatMinor(2800, "usd")).toContain("28.00");
    expect(formatMinor(null)).toBe("");
    expect(formatMinor(undefined)).toBe("");
  });

  it("finds the cheapest purchasable variant, or null", () => {
    const product = {
      id: "tee",
      category: "people",
      name: "Tee",
      description: "",
      photos: [],
      variants: [
        { sku: "a", label: "S", price: null },
        { sku: "b", label: "M", price: { amount: 3000, currency: "usd" } },
        { sku: "c", label: "L", price: { amount: 2800, currency: "usd" } },
      ],
    } satisfies StoreProduct;

    expect(fromPrice(product)).toEqual({ amount: 2800, currency: "usd" });
    expect(fromPrice({ ...product, variants: [product.variants[0]!] })).toBeNull();
  });

  it("describes an order by its first item and how many more", () => {
    const order = {
      items: [
        { name: "Tee", quantity: 2 },
        { name: "Cap", quantity: 1 },
      ],
    } as Pick<Order, "items">;
    expect(describeItems(order)).toBe("Tee and 2 more");
    expect(describeItems({ items: [{ name: "Tee", quantity: 1 }] } as Pick<Order, "items">)).toBe("Tee");
    expect(describeItems({ items: [] } as Pick<Order, "items">)).toBe("Order");
  });
});
