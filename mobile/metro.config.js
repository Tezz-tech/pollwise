// Expo SDK 52+ configures Metro for npm workspaces automatically through expo/metro-config, so
// @pollwise/shared resolves without extra watchFolders. If resolution ever breaks, fix it here
// rather than copying shared code (CLAUDE.md, repository layout).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
