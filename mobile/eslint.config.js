const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', '.expo/**'],
    rules: {
      // Provider initialization and explicit async loaders are safe in this app.
      'react-hooks/set-state-in-effect': 'off',
      // Context modules intentionally colocate their hook with the provider.
      'react-refresh/only-export-components': 'off',
    },
  },
]);
