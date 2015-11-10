'use strict';


var done = function() {
	console.log('TEST DONE!');
};

var test = function() {

	var path = require('path');
	var svgzr = require( path.join( '..', 'lib', 'svgzr' ) );

	var options = {
		files: {
			cwdSvg: 'test/fixtures/svg/',
			cwdPng: "test/result/png/"
		},
		svg: {
			destFile: 'test/result/_svg.scss'
		},
		png: true,
		fallback : {
			mixinName: 'svg-fallback',
			destFile: 'test/result/_svg-fallback.scss'
		}
	};

	svgzr(options, done);





};
test();
