import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import ReportUserScreen from "./ReportUserScreen";
import { reportUser } from "../../api/safety";
import { AppThemeProvider } from "../../context/AppThemeContext";
import { ToastProvider } from "../../components/ui";

jest.mock("../../api/safety", () => ({
  reportUser: jest.fn(),
  REPORT_REASONS: [
    { value: "harassment", label: "Harassment or bullying" },
    { value: "other", label: "Something else" },
  ],
}));

/**
 * Filing a report.
 *
 * The old screen posted `{ Content, ReportedUser, Reporter, Status }` to a
 * lowercase schema - four keys strict mode dropped - and let the client set the
 * status. It also offered "Block User" as a second, separately-failable request
 * in the success dialog.
 */

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const DEFAULT_PARAMS = { userId: "u1", name: "Bo's owner" };

const renderScreen = (params = DEFAULT_PARAMS) =>
  render(
    <AppThemeProvider>
      <ToastProvider>
        <ReportUserScreen route={{ params }} navigation={navigation} />
      </ToastProvider>
    </AppThemeProvider>
  );

const tapById = async (id) => {
  const element = await waitFor(() => screen.getByTestId(id));
  await fireEvent.press(element);
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  reportUser.mockResolvedValue({ blocked: true, report: { status: "pending" } });
});

describe("ReportUserScreen", () => {
  it("does not throw when it arrives with no params", async () => {
    // A deep link or a push notification opens the screen with nothing.
    await renderScreen(null);

    await waitFor(() => expect(screen.getByTestId("report-missing")).toBeTruthy());
  });

  it("needs a reason before it will send", async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId("report-content"), "They were abusive.");
    await tapById("report-submit");

    expect(reportUser).not.toHaveBeenCalled();
    // A nudge, not a modal: the six reasons are on the screen already.
    await waitFor(() => expect(screen.getByText(/Pick a reason/)).toBeTruthy());
  });

  it("needs a description before it will send", async () => {
    await renderScreen();

    await tapById("report-reason-harassment");
    await tapById("report-submit");

    expect(reportUser).not.toHaveBeenCalled();
  });

  it("sends the reason and the text, and never a status", async () => {
    await renderScreen();

    await tapById("report-reason-harassment");
    await fireEvent.changeText(screen.getByTestId("report-content"), "Kept messaging me.");
    await tapById("report-submit");

    await waitFor(() =>
      expect(reportUser).toHaveBeenCalledWith({
        userId: "u1",
        reason: "harassment",
        content: "Kept messaging me.",
        contentType: "user",
        reportedContent: undefined,
      })
    );
  });

  it("says the person was blocked, because filing did that too", async () => {
    await renderScreen();

    await tapById("report-reason-harassment");
    await fireEvent.changeText(screen.getByTestId("report-content"), "Kept messaging me.");
    await tapById("report-submit");

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "Thanks for telling us",
        expect.stringContaining("blocked"),
        expect.any(Array)
      )
    );
  });

  it("surfaces a failure instead of claiming it was filed", async () => {
    reportUser.mockRejectedValue({ response: { data: { message: "Try later" } } });
    await renderScreen();

    await tapById("report-reason-harassment");
    await fireEvent.changeText(screen.getByTestId("report-content"), "Kept messaging me.");
    await tapById("report-submit");

    await waitFor(() => expect(screen.getByText("Try later")).toBeTruthy());
  });

  it("passes through what is being reported when it is not the person", async () => {
    await renderScreen({
      userId: "u1",
      name: "Bo's owner",
      contentType: "message",
      reportedContent: "message:m1",
    });

    await tapById("report-reason-other");
    await fireEvent.changeText(screen.getByTestId("report-content"), "Sent something vile.");
    await tapById("report-submit");

    await waitFor(() =>
      expect(reportUser).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: "message",
          reportedContent: "message:m1",
        })
      )
    );
  });
});
