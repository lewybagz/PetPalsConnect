/**
 * App test setup.
 *
 * jest-expo supplies the React Native preset and the Expo module mocks;
 * `transformIgnorePatterns` is the usual Expo incantation, needed because the
 * RN ecosystem ships untranspiled ES modules that Jest must run through Babel.
 */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|twrnc|@react-native-firebase/.*|immer|@reduxjs/toolkit|redux|reselect))",
  ],
  collectCoverageFrom: [
    "src/**/*.{js,jsx}",
    "!src/**/*.test.{js,jsx}",
    "!**/node_modules/**",
  ],
  testMatch: ["<rootDir>/src/**/*.test.{js,jsx}", "<rootDir>/__tests__/**/*.test.{js,jsx}"],
};
