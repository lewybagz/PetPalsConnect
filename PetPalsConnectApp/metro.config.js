const { getDefaultConfig } = require("@react-native/metro-config");
module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
    maxWorkers,
  } = await getDefaultConfig();

  return {
    transformer: {
      babelTransformerPath: require.resolve("nativewind/babel"),
    },
    resolver: {
      assetExts: assetExts.filter((ext) => ext !== "svg"),
      sourceExts: [...sourceExts, "svg"],
    },
    maxWorkers: maxWorkers || 6,
  };
})();
