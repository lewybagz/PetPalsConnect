import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import ShopScreen from "./ShopScreen";
import ProductDetailScreen from "./ProductDetailScreen";
import { fetchCatalogue, startCheckout } from "../../api/store";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/store", () => ({
  ...jest.requireActual("../../api/store"),
  fetchCatalogue: jest.fn(),
  startCheckout: jest.fn(),
}));

/**
 * The shop and a product page.
 *
 * The states that matter: a shop with no Stripe key says it is not open
 * rather than erroring; a variant with no price lists as coming soon and
 * cannot be bought; and "Buy" sends exactly the sku and quantity on screen.
 */

const navigation = { navigate: jest.fn() };

const CATALOGUE = {
  configured: true,
  categories: [
    { key: "tracking", label: "Tracking" },
    { key: "people", label: "For you" },
  ],
  products: [
    {
      id: "tracking-collar",
      category: "tracking",
      name: "PetPals Tracking Collar",
      description: "A collar with a tracker in it.",
      photos: [],
      requiresDeviceSetup: true,
      variants: [
        { sku: "collar-tracker-s", label: "Small", price: { amount: 12900, currency: "usd" } },
        { sku: "collar-tracker-m", label: "Medium", price: { amount: 12900, currency: "usd" } },
      ],
    },
    {
      id: "tee",
      category: "people",
      name: "PetPals Tee",
      description: "A tee.",
      photos: [],
      variants: [
        { sku: "tee-s", label: "S", price: null },
        { sku: "tee-m", label: "M", price: { amount: 2800, currency: "usd" } },
      ],
    },
  ],
};

const wrap = (node) => <ToastProvider>{node}</ToastProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  fetchCatalogue.mockResolvedValue(CATALOGUE);
  startCheckout.mockResolvedValue({ id: "cs_1", url: "https://x" });
});

describe("ShopScreen", () => {
  it("lists products by category with a from-price", async () => {
    await render(wrap(<ShopScreen navigation={navigation} />));

    await waitFor(() => expect(screen.getByTestId("shop-section-tracking")).toBeTruthy());
    expect(screen.getByTestId("product-tee")).toBeTruthy();
    expect(screen.getByText(/28\.00/)).toBeTruthy();
  });

  it("opens a product by id", async () => {
    await render(wrap(<ShopScreen navigation={navigation} />));
    const card = await waitFor(() => screen.getByTestId("product-tee"));
    await fireEvent.press(card);
    expect(navigation.navigate).toHaveBeenCalledWith("ProductDetail", { productId: "tee" });
  });

  it("says the shop is not open yet when the server has no Stripe key", async () => {
    fetchCatalogue.mockResolvedValue({ ...CATALOGUE, configured: false });
    await render(wrap(<ShopScreen navigation={navigation} />));
    await waitFor(() => expect(screen.getByTestId("shop-closed")).toBeTruthy());
    expect(screen.queryByTestId("product-tee")).toBeNull();
  });
});

describe("ProductDetailScreen", () => {
  const route = { params: { productId: "tee" } };

  it("defaults to a variant that can be bought and sends it with the quantity", async () => {
    await render(wrap(<ProductDetailScreen route={route} navigation={navigation} />));
    await waitFor(() => expect(screen.getByTestId("product-detail")).toBeTruthy());

    // S has no price, so M is the default and S cannot be chosen.
    expect(screen.getByTestId("variant-tee-s").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId("quantity-more"));
    await fireEvent.press(screen.getByTestId("quantity-more"));
    expect(screen.getByTestId("quantity").props.children).toBe(3);
    expect(screen.getByTestId("product-total").props.children).toContain("84.00");

    await fireEvent.press(screen.getByTestId("product-buy"));
    expect(startCheckout).toHaveBeenCalledWith([{ sku: "tee-m", quantity: 3 }]);
  });

  it("never goes below one or above the per-line cap", async () => {
    await render(wrap(<ProductDetailScreen route={route} navigation={navigation} />));
    await waitFor(() => expect(screen.getByTestId("product-detail")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("quantity-less"));
    expect(screen.getByTestId("quantity").props.children).toBe(1);
    for (let i = 0; i < 15; i += 1) await fireEvent.press(screen.getByTestId("quantity-more"));
    expect(screen.getByTestId("quantity").props.children).toBe(10);
  });

  it("shows what the collar does in the app, and never calls it a safety device", async () => {
    await render(
      wrap(
        <ProductDetailScreen
          route={{ params: { productId: "tracking-collar" } }}
          navigation={navigation}
        />
      )
    );
    await waitFor(() => expect(screen.getByTestId("product-tracking-note")).toBeTruthy());
    expect(screen.getAllByText(/last reported/).length).toBeGreaterThan(0);
    expect(screen.getByText(/not a safety device/)).toBeTruthy();
    expect(screen.queryByText(/keeps? your (pet|dog) safe/i)).toBeNull();
  });

  it("cannot buy when the shop is closed", async () => {
    fetchCatalogue.mockResolvedValue({ ...CATALOGUE, configured: false });
    await render(wrap(<ProductDetailScreen route={route} navigation={navigation} />));
    await waitFor(() => expect(screen.getByTestId("product-detail")).toBeTruthy());
    await fireEvent.press(screen.getByTestId("product-buy"));
    expect(startCheckout).not.toHaveBeenCalled();
  });

  it("a product that is not in the catalogue offers the way back", async () => {
    await render(
      wrap(<ProductDetailScreen route={{ params: { productId: "nope" } }} navigation={navigation} />)
    );
    await waitFor(() => expect(screen.getByTestId("product-missing")).toBeTruthy());
  });
});
