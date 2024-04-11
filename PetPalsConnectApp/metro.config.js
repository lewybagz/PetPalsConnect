const { getDefaultConfig } = require("metro-config");

module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
    maxWorkers,
  } = await getDefaultConfig();

  return {
    transformer: {
      babelTransformerPath: require.resolve("nativewind/dist/transformer"),
      // Metro has its minifier integrated, no need for TerserPlugin here
    },
    resolver: {
      assetExts: assetExts.filter((ext) => ext !== "svg"), // Exclude 'svg' from the list of asset extensions...
      sourceExts: [...sourceExts, "svg"], // ...and include it in the list of source extensions
    },
    maxWorkers: maxWorkers || 6,
  };
})();
