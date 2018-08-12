/* globals process, require, console */
/* eslint-disable no-console */

const filename = process.argv[2];
console.log('reading file', filename);
const lineReader = require('readline').createInterface({
    input: require('fs').createReadStream(filename)
});
const pathParser = require('../js/pathparser');

lineReader.on('line', function (line) {
    console.log('\nin:', line);
    try {
        const out = pathParser.parse(line);
        console.log('out:', JSON.stringify(out));
    } catch (err) {
        console.error(err.toString());
    }
});
