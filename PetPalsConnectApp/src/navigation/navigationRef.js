import { createNavigationContainerRef } from "@react-navigation/native";

/**
 * Lets non-component code (push notification handlers, services) navigate
 * without needing to be inside the React tree.
 */
export const navigationRef = createNavigationContainerRef();

export const navigate = (name, params) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
};
