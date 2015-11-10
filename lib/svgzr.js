/*
 * svgzr
 * https://github.com/aditollo/svgzr
 *
 * Copyright (c) 2014-2015 Alfonso di Tollo
 * Licensed under the MIT license.
 */

'use strict';



	var svg2png = require('svg2png');
	var path = require('path');
	var parseString = require('xml2js').parseString;
	var Mustache = require('mustache');
	var SvgoLib = require('svgo');
	var svgo;
	var Q = require('q');
	var fs = require('fs');

	var putPx = function(dimension) {
		if (typeof dimension !== 'undefined') {
			return dimension.indexOf('px') > -1 ? dimension : dimension + "px";
		}
	};

	var cleanFolder = function(folderName) {
		fs.readdirSync(folderName).forEach(function(file, i) {
			if(path.extname(file) == ".png") {
				fs.unlink(path.join(folderName, file));
			}
		});
	};

	var checkTemplateFile = function(fileName) {
		try {
			var stats = fs.lstatSync(fileName);
			if (stats.isFile()) {
				return fs.readFileSync(fileName, "utf8");
			}
			else {
				//grunt.fail.fatal("Missing template file: \"" + fileName + "\"");
				console.error("Missing template file: \"" + fileName + "\"");
				//TODO portare a uscita da svgzr
				return null;
			}
		}
		catch (e) {
			console.error("Missing template file: \"" + fileName + "\"");
			//TODO portare a uscita da svgzr
			return null;
		}
	};

	var svgToPng = function(file) {
		return  Q.Promise(function(resolve, reject, notify) {
			svg2png(file.src, file.dest, function (err) {
				if( err ){
					reject(err);
				}
				else {
					console.log('image converted to \"' + file.dest + '\".');
					resolve(file.dest);
				}
			});
		});
	};

	var svgMin = function(source) {
		return  Q.Promise(function(resolve, reject, notify) {
			if(svgo) {
				svgo.optimize(source, function (result) {
					if (result.error) {
						console.warn('Minify: error parsing SVG:', result.error);
						reject();
					}
					resolve(result.data) ;
				});
			}
			else {
				reject();
			}
		}) ;
	};

	var getDimensions = function(obj) {
		return  Q.Promise(function(resolve, reject, notify) {
			parseString(obj.originalSvg, function (err, result) {
				obj.width = putPx(result.svg.$.width);
				obj.height = putPx(result.svg.$.height);
				resolve(obj);
			});
		});

	};

	var encode = function(svgData, options, baseName) {
		return  Q.Promise(function(resolve, reject, notify) {
			var obj = {
				className: options.prefix + baseName,
				size: "",
				originalSvg: svgData
			};
			if(options.encodeType === 'uri') {
				obj.encoded = encodeURIComponent(svgData);
			}
			else {
				obj.encoded = new Buffer(svgData).toString('base64');
			}
			obj.base64 = obj.encoded;
			obj.isBase64 = (options.encodeType === 'base64');
			resolve(obj);
		});
	};


	var svgToTemplate = function(file, options, data) {
		var srcSvg = fs.readFileSync(file.src, "utf8");
		var baseName =  path.basename(file.src);

		while (path.extname(baseName)!== ''){
			baseName = path.basename(baseName, path.extname(baseName));
		}


		return svgMin(srcSvg)
			.then(function(result) {
				console.log(baseName + ' minified. Saved ' + Math.round((srcSvg.length - result.length)/ srcSvg.length * 100) + '%.');
				return result;
			}).fail(function() {
				return srcSvg;
			}).then(function(svgData) {
				return encode(svgData, options, baseName);
			}).then(function(obj) {
				return getDimensions(obj);
			}).then(function(obj) {
				if(options.fallback) {
					obj.fileName = baseName;
				}
				return obj;
			})
			.then(function(obj) {

				data.allClasses += ", ." + obj.className;
				if(data.allClasses.indexOf(", ") === 0) {
					data.allClasses = data.allClasses.substring(2, data.allClasses.length);
				}
				data.items.push(obj);
				console.log('encoded data created from \"'+file.src+'\"');
			});

	};
	var pngToTemplate = function(file, options, data) {
		var baseName =  path.basename(file, data.ext);
		var obj = {
			className: options.prefix + baseName,
			mixinName: options.fallback.mixinName,
			dir: data.dir,
			lastDir: options.fallback.lastDir,
			fileName: baseName
		};
		data.items.push({
			className: options.prefix + baseName,
			fileName: baseName
		});
	};
	var firstCycle = function(options) {

		var converter = null;
		var svgData = {
			items: [],
			allClasses: ""
		};

		var result = Q.fcall(function() {  });

		if(!options.svg && !options.png){
			return result;
		}

		var filesSvg = [];
		fs.readdirSync(options.files.cwdSvg).forEach(function(file, i) {
			if(path.extname(file) == ".svg") {
				filesSvg.push({
					src: path.join(options.files.cwdSvg, file),
					dest: path.join(options.files.cwdPng, path.basename(file,".svg") + ".png")
				});
			}
		});

		result = result.then(function() {
			if(options.png && fs.lstatSync(options.files.cwdSvg).isDirectory()) {
				cleanFolder(options.files.cwdPng);
			}
		});

		filesSvg.forEach(function(file) {
			if(options.svg) {
				result = result.then(function() {
					return svgToTemplate(file, options, svgData);
				});
			}
			if(options.png) {
				result = result.then(function() {
					return svgToPng(file);
				});
			}
		});

		return result.then(function() {

			if(options.svg && filesSvg.length !== 0) {
				if(options.png && options.fallback) {
					svgData.fallback = {
						dir: options.fallback.dir,
						lastDir: path.basename(options.fallback.dir),
						ext: '.png',
						mixinName: options.fallback.mixinName

					};
				}
				console.log("Writing svg template.");
				options.templateFileSvg = checkTemplateFile(options.templateFileSvg);
				var rendered = Mustache.render(options.templateFileSvg, svgData);
				fs.writeFileSync(options.svg.destFile, rendered, {encoding: "utf8"});
			}
		}).fail(function(err) {
			//grunt.fatal( err );
			console.error(err);
            //TODO portare a uscita da svgzr
		});

	};
	var createFallback = function(options) {
		var fallbackData = {
			allClasses: "",
			items: [],
			dir: options.fallback.dir,
			lastDir: path.basename(options.fallback.dir),
			ext: '.png',
			mixinName: options.fallback.mixinName
		};

		var filesFallback = [];
		fs.readdirSync(options.files.cwdPng).forEach(function(file, i) {
			if(path.extname(file) == fallbackData.ext) {
				filesFallback.push(path.join(options.files.cwdPng, file));
			}
		});

		filesFallback.forEach(function(file, i) {
			pngToTemplate(file, options, fallbackData);
		});

		if(filesFallback.length !== 0) {
			console.log("Writing png fallback template.");
			options.templateFileFallback = checkTemplateFile(options.templateFileFallback);
			var rendered = Mustache.render(options.templateFileFallback, fallbackData);
			fs.writeFileSync(options.fallback.destFile, rendered, {encoding: "utf8"});
		}
	};

	module.exports = function svgzr(newOptions, callback) {
		var options = {
			files: {
				cwdSvg: 'svg/',
				cwdPng: "png/"
			},
			prefix: 'svg-',
			encodeType: 'uri',
			svgo: true,
			svg: false,
			fallback : false,
			png: false

		};

		for (var attrname in newOptions) { options[attrname] = newOptions[attrname]; }

		if(!options.templateFileSvg) {
			options.templateFileSvg = path.join(__dirname, '..', 'test', 'templateSvg.mst');
		}
		if(!options.templateFileFallback) {
			options.templateFileFallback = path.join(__dirname, '..', 'test', 'templateFallback.mst');
		}

		if(options.encodeType !== 'uri' && options.encodeType !== 'base64') {
			options.encodeType = 'uri';
		}
		if(options.fallback){
			if(!options.fallback.mixinName) {
				options.fallback.mixinName = 'svg-fallback';
			}
			if(!options.fallback.dir){
				options.fallback.dir = path.relative(path.dirname(options.fallback.destFile), options.files.cwdPng).split(path.sep).join('/') + '/';
			}
		}

		var svgoOptions;
		if(options.svgo === true ) {
			svgoOptions = {
				plugins: [
					{removeViewBox: false},
					{convertPathData: { straightCurves: false }}
				]
			};
		}
		else if(typeof(options.svgo)=== "object" && options.svgo !== null){
			svgoOptions = options.svgo;
		}
		else {
			options.svgo = false;
		}
		if(options.svgo !== false){
			svgo = new SvgoLib(svgoOptions);
		}


		firstCycle(options)
			.then(function() {
				if(options.fallback) {
					createFallback(options);
				}
			}).done(function() {
				if (typeof callback === "function") {
					callback();
				}
			});
	};
