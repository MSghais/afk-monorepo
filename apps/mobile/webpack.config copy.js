const { createExpoWebpackConfigAsync } = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: ['nativewind']
      }
    },
    argv
  );
  
  // Add custom entry point
  config.entry = ['./index.web.js'];

  // Configure module resolution
  config.resolve = {
    ...config.resolve,
    extensions: ['.web.js', '.web.jsx', '.web.ts', '.web.tsx', '.js', '.jsx', '.ts', '.tsx'],
    alias: {
      ...config.resolve.alias,
      'react-native$': 'react-native-web'
    }
  };

  // Configure module rules
  config.module.rules.push({
    test: /\.(js|jsx|ts|tsx)$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: [
          ['@babel/preset-env', {
            modules: false,
            targets: {
              browsers: ['last 2 versions', 'not dead']
            }
          }],
          '@babel/preset-react',
          '@babel/preset-typescript'
        ],
        plugins: [
          ['@babel/plugin-transform-runtime', {
            regenerator: true,
            useESModules: true
          }],
          'nativewind/babel'
        ]
      }
    }
  });

  // Configure output
  config.output = {
    ...config.output,
    publicPath: '/',
    globalObject: 'this'
  };

  // Enable ES modules
  config.experiments = {
    ...config.experiments,
    topLevelAwait: true
  };

  return config;
};
