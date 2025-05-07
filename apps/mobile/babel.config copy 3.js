module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { 
        jsxImportSource: 'nativewind',
        web: {
          unstable_transformProfile: 'hermes-canary'
        }
      }],
      'nativewind/babel'
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            'pixel_component': '../../packages/pixel_component/src',
            'afk_nostr_sdk': '../../packages/afk_nostr_sdk/src',
            'common': '../../packages/common/src',
            'pixel_ui': '../../packages/pixel_ui/src',
          },
          extensions: [
            '.web.js',
            '.web.jsx',
            '.web.ts',
            '.web.tsx',
            '.ios.ts',
            '.android.ts',
            '.ts',
            '.ios.tsx',
            '.android.tsx',
            '.tsx',
            '.jsx',
            '.js',
            '.json',
          ],
        },
      ],
      'react-native-reanimated/plugin',
      "@babel/plugin-proposal-export-namespace-from",
      ["@babel/plugin-transform-runtime", {
        regenerator: true,
        useESModules: true
      }]
    ],
  };
};
