var webpack = require('webpack')
var autoprefixer = require('autoprefixer')
var ExtractTextPlugin = require('extract-text-webpack-plugin')
var HtmlWebpackPlugin = require('html-webpack-plugin')
var ManifestPlugin = require('webpack-manifest-plugin')
var rimraf = require('rimraf')
var path = require('path')

var options = require('./options')

if (!options.isDevServer) {
  console.error('Removing output directory:', options.paths.output)
  rimraf.sync(options.paths.output)
}


module.exports = {
  context: options.paths.context,

  entry: {
    main: skipFalsy([
      options.isDevServer && 'react-hot-loader/patch',
      // activate HMR for React

      options.isDevServer && ('webpack-dev-server/client?http://localhost:' + options.devServerPort),
      // bundle the client for webpack-dev-server
      // and connect to the provided endpoint

      options.isDevServer && 'webpack/hot/only-dev-server',
      // bundle the client for hot reloading
      // only- means to only hot reload for successful updates

      require.resolve('./polyfills'),

      options.paths.appEntryPoint,
      // the entry point of our app
    ]),
  },

  output: {
    filename: options.isDevServer ? '[name].dev.js' : '[name].[chunkhash:8].js',
    path: options.paths.output,
    publicPath: options.publicUrl,
    pathinfo: options.dev,
    libraryTarget: 'umd',
    library: 'graphGrailEther',
  },

  resolve: {
    extensions: ['.js', '.json', '.jsx'],
    alias: {
      '~': path.resolve(options.paths.context, 'src'),
      'styles': path.resolve(options.paths.context, 'styles'),
      'assets': path.resolve(options.paths.context, 'assets'),
    }
  },

  module: {
    rules: [
      { test: /\.js$/,
        exclude: /node_modules(?![/]ethereum-address)/,
        use: [
          { loader: 'babel-loader' },
        ],
      },
    ],
  },

  plugins: skipFalsy([

    new HtmlWebpackPlugin({
      inject: true,
      template: options.paths.indexHtml,
      minify: !options.uglify ? undefined : {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      },
    }),

    new webpack.DefinePlugin(options.env),

    options.uglify && new webpack.optimize.UglifyJsPlugin({
      compress: {
        screw_ie8: true, // React doesn't support IE8
        warnings: false
      },
      mangle: {
        screw_ie8: true
      },
      output: {
        comments: false,
        screw_ie8: true
      },
      sourceMap: true,
    }),

    !options.isDevServer && new ManifestPlugin({
      fileName: 'asset-manifest.json'
    }),

    options.isDevServer && new webpack.HotModuleReplacementPlugin(),
    // enable HMR globally

    new webpack.NamedModulesPlugin(),
    // prints more readable module names in the browser console on HMR updates
  ]),

  bail: !options.isDevServer,

  devtool: options.isDevServer ? 'cheap-module-eval-source-map' : 'source-map',

  devServer: {
    port: options.devServerPort,

    hot: true,
    // enable HMR on the server

    contentBase: options.paths.output,
    // match the output path

    publicPath: options.publicUrl,
    // match the output `publicPath`

    historyApiFallback: {
      rewrites: [
        { from: /./, to: options.publicUrl + 'index.html' },
      ]
    },

    stats: 'minimal',
  },
}

function skipFalsy(array) {
  return array.filter(item => !!item)
}
