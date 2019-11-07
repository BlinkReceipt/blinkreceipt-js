const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/blinkreceipt.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'blinkreceipt.js',
        sourceMapFilename: "blinkreceipt.js.map"
    },
    devtool: 'source-map',
    module: {
        rules: [{
            test: /\.js$/,
            exclude: /node_modules/,
            use: ['babel-loader']
        }]
    },
    plugins: [
        new CopyPlugin([
            {
                from: 'src/media',
                to: 'media'
            },
            {
                from: 'src/css',
                to: 'css'
            }
        ])
    ],
    watch: true,
    watchOptions: {
        aggregateTimeout: 300,
        poll: 300
    }
};