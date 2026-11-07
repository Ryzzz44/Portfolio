// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The Anthropic SDK's ESM build has a circular import that throws a TDZ
// ReferenceError under Metro's dev (non-inlined) module order. Resolve it
// through its CommonJS entry points instead, which tolerate the cycle.
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const ctx = moduleName.startsWith('@anthropic-ai/sdk')
    ? { ...context, unstable_enablePackageExports: false }
    : context;
  return (defaultResolve ?? context.resolveRequest)(ctx, moduleName, platform);
};

module.exports = config;
