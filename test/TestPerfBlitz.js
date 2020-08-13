"use strict";
/*
import { GwLogger } from "../GwLogger.js";
*/

const GwLogger = require("../GwLogger").GwLogger;

const log = new GwLogger("all", true, true);
let nIters = 10;
const loglevel = ["notice", "info", "dev", "debug", "trace"];
let loggers = [];
const nLoggers = 5;
let loggerStatus = new Array(nLoggers);
let allStarted = false;

const unlinkSync = require("fs").unlinkSync;


const blitz = function() {
	let bufferOk;
	console.log("In blitz.");	
	for (let i=0; i<nIters; i++) {
	//	if (i === 20) unlinkSync("./logfiles/logJsonFile.log");
		for (let c=0; c<nLoggers; c++) {
			bufferOk = loggers[c][loglevel[c]]("c="+c+" n="+i);
			if (bufferOk !== null && bufferOk !== undefined && !bufferOk) {
				//console.log("--------------------------------  BACKPRESSURE ----------------------------");
			} 			
		}
	}
}
// Send a priming log statement to each logger, then run blitz
const primeBlitz = () => {
	for (let c=0; c<nLoggers; c++) {
		console.log("started logger["+c+"], ", loglevel[c]);
		loggers[c][loglevel[c]]("c="+c+" priming log statement.");
	}
	//setTimeout(function() {unlinkSync("./logfiles/logJsonFile.log");}, 5000); // out with the old	
	setTimeout(blitz, 8000);
	setTimeout(function() { nIters = 60; blitz(); }, 20000);
}

// create the nLoggers loggers
for (let i=0; i<nLoggers; i++) {
	loggers[i]  = new GwLogger("all", false, true);
	loggers[i].setIsConsoleTs(true);
	loggerStatus[i] = 2;
}

primeBlitz(); // will send some priming log statements, then chain to blitz

	
	