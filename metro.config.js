const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Optimize production minification: strip debug console logs while preserving warn/error
if (process.env.NODE_ENV === 'production') {
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      compress: {
        drop_console: ['log', 'debug', 'info'],
      },
    },
  };
}

module.exports = withNativeWind(config, { input: "./global.css" });
