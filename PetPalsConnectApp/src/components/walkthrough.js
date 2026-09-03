import React from "react";

/**
 * Inert stand-in for `react-native-copilot`.
 *
 * The onboarding walkthrough was built against react-native-copilot 3.x, whose
 * last release predates the New Architecture and does not work on React Native
 * 0.86. Rather than delete the tour markup - which is real design work worth
 * keeping - these shims let the screens render normally with the tour disabled.
 *
 * To bring the walkthrough back: install a maintained tour library, then
 * reimplement these three exports against it. No screen code needs to change.
 */

/** Renders its children; the tooltip/highlight is a no-op. */
export const CopilotStep = ({ children }) => <>{children}</>;

/** Previously wrapped a component so the tour could measure it. */
export const walkthroughable = (Component) => Component;

/** HOC that supplied `start`/`copilotEvents` props to the wrapped screen. */
export const copilot = () => (Component) => {
  const WithWalkthrough = (props) => (
    <Component
      {...props}
      start={() => {}}
      copilotEvents={{ on: () => {}, off: () => {} }}
    />
  );
  WithWalkthrough.displayName = `withWalkthrough(${
    Component.displayName || Component.name || "Component"
  })`;
  return WithWalkthrough;
};

export default { copilot, walkthroughable, CopilotStep };
