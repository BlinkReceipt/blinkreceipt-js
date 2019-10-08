const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/blinkreceipt.js',
    output: {
        filename: 'blinkreceipt.js',
        path: path.resolve(__dirname, 'dist'),
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