const path = require('path');
const isStaticExport = process.env.NEXT_OUTPUT_MODE === 'export';

module.exports = {
  output: isStaticExport ? 'export' : undefined,
  devIndicators: false,
  webpack: (config, { dev }) => {
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg')
    );

    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/i;
    }

    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      classnames$: path.join(__dirname, 'node_modules/classnames/index.js'),
      antd$: path.join(__dirname, 'node_modules/antd/lib/index.js'),
      'antd/es': path.join(__dirname, 'node_modules/antd/lib'),
      '@ant-design/icons$': path.join(
        __dirname,
        'node_modules/@ant-design/icons/lib/index.js'
      ),
      '@ant-design/icons/es': path.join(
        __dirname,
        'node_modules/@ant-design/icons/lib'
      ),
      'rc-util/es': path.join(__dirname, 'node_modules/rc-util/lib'),
      'rc-picker/es': path.join(__dirname, 'node_modules/rc-picker/lib'),
      '@rc-component/util/es': path.join(
        __dirname,
        'node_modules/@rc-component/util/lib'
      ),
    };

    return config;
  },
};
