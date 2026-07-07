const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /\.local\//,
  /\.git\//,
];

config.watchFolders = (config.watchFolders || []).filter(
  (f) => !f.includes(".local")
);

module.exports = config;
