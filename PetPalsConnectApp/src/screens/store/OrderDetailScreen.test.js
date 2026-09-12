import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react-native";

import OrderDetailScreen from "./OrderDetailScreen";
import OrdersScreen from "./OrdersScreen";
import { fetchOrder, fetchOrderBySession, fetchOrders } from "../../api/store";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/store", () => ({
  ...jest.requireActual("../../api/store"),
  fetchOrder: jest.fn(),
  fetchOrderBySession: jest.fn(),
  fetchOrders: jest.fn(),
}));

/**
 * The order screens.
 *
 * The one behaviour worth a test above the rest: coming back from Stripe
 * before the webhook has landed shows "confirming", polls, and then shows the
 * order - it never claims "paid" on the strength of a redirect.
 */

const navigation = { navigate: jest.fn() };
const wrap = (node) => <ToastProvider>{node}</ToastProvider>;

const ORDER = {
  _id: "ord-1",
  user: "u1",
  status: "paid",
  stripeSessionId: "cs_1",
  items: [{ sku: "tee-m", name: "PetPals Tee", variantLabel: "M", quantity: 2, unitAmount: 2800, currency: "usd" }],
  amountSubtotal: 5600,
  amountTax: 400,
  amountShipping: 0,
  amountTotal: 6000,
  amountRefunded: 0,
  currency: "usd",
  shipping: { name: "Buyer", line1: "1 Main St", city: "Phoenix", state: "AZ", postalCode: "85001" },
  createdDate: "2026-09-01T00:00:00.000Z",
  modifiedDate: "2026-09-01T00:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchOrder.mockResolvedValue(ORDER);
  fetchOrders.mockResolvedValue([ORDER]);
});

describe("OrderDetailScreen", () => {
  it("renders an order by id: status, items, totals and the address", async () => {
    await render(
      wrap(<OrderDetailScreen route={{ params: { orderId: "ord-1" } }} navigation={navigation} />)
    );
    await waitFor(() => expect(screen.getByTestId("order-detail")).toBeTruthy());

    expect(screen.getByText("Paid - getting it ready")).toBeTruthy();
    expect(screen.getByTestId("order-item-0")).toBeTruthy();
    expect(screen.getByText(/60\.00/)).toBeTruthy();
    expect(screen.getByTestId("order-shipping")).toBeTruthy();
    expect(screen.getByText(/Phoenix, AZ, 85001/)).toBeTruthy();
    // A tee has no set-up step.
    expect(screen.queryByTestId("order-collar-setup")).toBeNull();
  });

  it("offers the collar set-up step once a collar order is paid", async () => {
    fetchOrder.mockResolvedValue({
      ...ORDER,
      items: [{ sku: "collar-tracker-m", name: "PetPals Tracking Collar", quantity: 1, unitAmount: 12900, requiresDeviceSetup: true }],
    });
    await render(
      wrap(<OrderDetailScreen route={{ params: { orderId: "ord-1" } }} navigation={navigation} />)
    );
    await waitFor(() => expect(screen.getByTestId("order-collar-setup")).toBeTruthy());
    await act(async () => {
      screen.getByTestId("order-collar-setup-button").props.onPress?.();
    });
  });

  it("says 'confirming' after a checkout redirect and keeps asking until the webhook lands", async () => {
    jest.useFakeTimers();
    try {
      fetchOrderBySession.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue(ORDER);

      await render(
        wrap(<OrderDetailScreen route={{ params: { sessionId: "cs_1" } }} navigation={navigation} />)
      );

      await waitFor(() => expect(screen.getByTestId("order-confirming")).toBeTruthy());
      expect(screen.getByText("Confirming your order")).toBeTruthy();
      expect(screen.queryByText(/Paid/)).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(3100);
      });
      await act(async () => {
        jest.advanceTimersByTime(3100);
      });

      await waitFor(() => expect(screen.getByTestId("order-detail")).toBeTruthy());
      expect(fetchOrderBySession).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it("stops waiting eventually and sends the buyer to their orders, without a second charge", async () => {
    jest.useFakeTimers();
    try {
      const now = Date.now();
      jest.setSystemTime(now);
      fetchOrderBySession.mockResolvedValue(null);

      await render(
        wrap(<OrderDetailScreen route={{ params: { sessionId: "cs_1" } }} navigation={navigation} />)
      );
      await waitFor(() => expect(screen.getByTestId("order-confirming")).toBeTruthy());

      // Past the polling window: the next tick gives up rather than asking again.
      jest.setSystemTime(now + 100 * 1000);
      await act(async () => {
        jest.advanceTimersByTime(3100);
      });

      await waitFor(() => expect(screen.getByTestId("order-confirming-slow")).toBeTruthy());
      expect(screen.getByText(/don't need to buy again/)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("OrdersScreen", () => {
  it("lists orders and opens one by id", async () => {
    await render(wrap(<OrdersScreen navigation={navigation} />));
    const row = await waitFor(() => screen.getByTestId("order-ord-1"));
    expect(screen.getByText("PetPals Tee and 1 more")).toBeTruthy();
    expect(screen.getByText("Paid - getting it ready")).toBeTruthy();

    await act(async () => {
      row.props.onPress?.() ?? row.parent?.props?.onPress?.();
    });
  });

  it("offers the shop when there is nothing yet", async () => {
    fetchOrders.mockResolvedValue([]);
    await render(wrap(<OrdersScreen navigation={navigation} />));
    await waitFor(() => expect(screen.getByTestId("orders-empty")).toBeTruthy());
  });
});
