import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import { NavigationContainer } from "@react-navigation/native";

import MyPlaydatesScreen from "./MyPlaydatesScreen";
import store from "../../redux/store";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/axios", () => ({ get: jest.fn(() => Promise.resolve({ data: [] })) }));
jest.mock("@expo/vector-icons", () =>
  new Proxy({}, { get: (_t, name) => String(name) })
);

/**
 * The empty state, which is the one state every new user sees first.
 *
 * This screen imported `Text` from `@react-navigation/material-top-tabs`,
 * which does not export it, and rendered it only when the list was empty - so
 * `undefined` went to the reconciler as a component type. Bundling, lint,
 * typecheck and the colour ban all passed; nothing renders a screen but a test.
 */

const renderScreen = () =>
  render(
    <Provider store={store}>
      <AppThemeProvider>
        <ToastProvider>
          <NavigationContainer>
            <MyPlaydatesScreen />
          </NavigationContainer>
        </ToastProvider>
      </AppThemeProvider>
    </Provider>
  );

test("an empty list renders its empty state instead of crashing", async () => {
  renderScreen();

  await waitFor(() => expect(screen.getByText("Nothing planned yet")).toBeTruthy());
});
