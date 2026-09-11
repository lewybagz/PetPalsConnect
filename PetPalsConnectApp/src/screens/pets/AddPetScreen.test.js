import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Provider } from "react-redux";

import AddPetScreen from "./AddPetScreen";
import store from "../../redux/store";
import api from "../../api/axios";
import { useAuthSession } from "../../context/AuthSessionContext";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/axios", () => ({ post: jest.fn() }));
jest.mock("../../context/AuthSessionContext", () => ({ useAuthSession: jest.fn() }));
jest.mock("../../services/photos", () => ({ PHOTO_LIMIT: 6, addPetPhoto: jest.fn() }));
jest.mock("react-native-dropdown-picker", () => () => null);
jest.mock("@react-native-picker/picker", () => {
  const React = require("react");
  const { View } = require("react-native");
  // A host view carrying the handler, so a test can fire "valueChange" at it.
  function Picker({ children, testID, onValueChange }) {
    return (
      <View testID={testID} onValueChange={onValueChange}>
        {children}
      </View>
    );
  }
  Picker.Item = function PickerItem() {
    return null;
  };
  return { Picker };
});

/**
 * What the form sends is what the form collected.
 *
 * Three fields were typed in and never posted: `healthInformation` had no
 * schema field at all, and `activityLevel` and `socialisation` are real
 * schema fields the matcher scores on that simply were not in the payload.
 * `check:schemas` audits backend write sites for missing required fields, so
 * an app-side field that never leaves the device is invisible to it. This is
 * the gate that was missing.
 */

const navigation = { goBack: jest.fn() };

const renderScreen = () =>
  render(
    <Provider store={store}>
      <AppThemeProvider>
        <ToastProvider>
          <AddPetScreen navigation={navigation} />
        </ToastProvider>
      </AppThemeProvider>
    </Provider>
  );

// RNTL 14 fires events asynchronously: state lands after the await.
const fillRequired = async () => {
  await fireEvent.changeText(screen.getByPlaceholderText("Pet's Name"), "Bo");
  await fireEvent(screen.getByTestId("pet-breed"), "valueChange", "Beagle");
  await fireEvent.changeText(screen.getByPlaceholderText("Age"), "3");
  await fireEvent.changeText(screen.getByTestId("pet-weight"), "25");
};

const queueAndSave = async () => {
  await fireEvent.press(screen.getByText("Add Pet"));
  await fireEvent.press(await waitFor(() => screen.getByText(/Save 1 pet/)));
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  return api.post.mock.calls[0][1];
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthSession.mockReturnValue({ refresh: jest.fn().mockResolvedValue() });
  api.post.mockResolvedValue({ data: { pet: { _id: "pet-1" }, matches: [] } });
});

describe("AddPetScreen", () => {
  it("sends every field it collects", async () => {
    await renderScreen();
    await fillRequired();
    await fireEvent(screen.getByTestId("pet-activity"), "valueChange", "high");
    await fireEvent(screen.getByTestId("pet-socialisation"), "valueChange", "extrovert");

    const body = await queueAndSave();

    expect(api.post).toHaveBeenCalledWith("/api/pets", expect.any(Object));
    expect(body).toEqual(
      expect.objectContaining({
        name: "Bo",
        species: "dog",
        breed: "Beagle",
        age: 3,
        weight: 25,
        activityLevel: "high",
        socialisation: "extrovert",
      })
    );
  });

  it("sends an untouched picker as absent, not as an empty string", async () => {
    // The schema's enums reject "", so an empty string would fail the whole save.
    await renderScreen();
    await fillRequired();

    const body = await queueAndSave();

    expect(body.activityLevel).toBeUndefined();
    expect(body.socialisation).toBeUndefined();
  });

  it("no longer offers a health box that goes nowhere", async () => {
    await renderScreen();

    expect(screen.queryByPlaceholderText("Health Information")).toBeNull();
    expect(screen.getByText(/add vaccination records/i)).toBeTruthy();
  });
});
