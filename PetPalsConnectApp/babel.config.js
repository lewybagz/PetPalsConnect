module.exports = function (api) {
  api.cache(true);

  const isProduction = api.env("production");

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "nativewind/babel",
      isProduction && "babel-plugin-transform-remove-console", // Remove console logs in production
      "babel-plugin-lodash", // Optimize lodash imports
    ].filter(Boolean), // Filter out false plugins
  };
};
