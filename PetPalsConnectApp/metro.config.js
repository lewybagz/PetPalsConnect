const { getDefaultConfig } = require("metro-config");
const TerserPlugin = require("terser-webpack-plugin"); // If using custom Terser settings

module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
    transformer,
    maxWorkers,
  } = await getDefaultConfig();

  return {
    transformer: {
      ...transformer,
      babelTransformerPath: require.resolve("nativewind/dist/transformer"),
      // Custom minification settings
      minifierConfig: {
        keep_classnames: true, // Example option
        keep_fnames: true, // Prevent mangle of class and function names
        // Add more Terser options as needed
      },
    },
    resolver: {
      assetExts: assetExts.filter((ext) => ext !== "svg"),
      sourceExts: [...sourceExts, "svg"],
      // Watch additional folders if necessary
    },
    // Configure maximum number of workers
    maxWorkers: maxWorkers || 2, // Adjust according to your machine's capability
    // Add more configurations as required
  };
})();
