"use strict";
// A directive for exceptions to ESLint no-init rule
/*global console, setTimeout, process, require */ 

const GwLogger = require("../GwLogger").GwLogger;
let assert;
const v8 = require("v8");
assert = require("assert").strict;
if (!assert) assert = require("assert"); // for node < 10.0 without strict mode
const fs = require("fs");
const path = require("path");
// -- end of require section

const versionRef = "1.5.2"; // set to target version of GwLogger
const showStackTrace = true;

const getRandomInt = (max) => {
  return Math.floor(Math.random() * Math.floor(max));
};

const showPercentage = function(msg, percentage){
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`${msg} ${percentage}%...`);
};

const tlog = new GwLogger("notice", true, true
	, "./logfiles/Unit Test Results.log");
tlog.notice("-----------------------------  Enduro Testing Begins "
	+ "-----------------------------------------------");
tlog.setModuleName("Enduro");
tlog.notice("===> EnduroGwLogger.js is running, logfile is: "
	+ "./logfiles/Unit Test Results.log");
	
let nTests = 0; // # of tests attempted
let nPassed = 0;

const test_getVersion = function() {
	nTests++;
	try {
	const ver = GwLogger.getVersion();
	assert.equal(ver, versionRef);
	nPassed++;
	tlog.info("test_getVersion Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_getVersion: ");
		if (showStackTrace) tlog.error(err);
	}
};
/*
 *	Sample profiles for Endurance Testing.
*/
// Example: template JSON file for logging to a network shared drive
// = new GwLogger({ profileFn: "./enduroNetworkTest.json" });

// Used for testing on local machine in test subdirectories
// = new GwLogger({ profileFn: "./enduroLocalTest.json" });

// create several instances of the logger to compete for resources
// They must all use the same logfile and roll directory
let loggers = [];
const nLoggers = 3;
for (let i=0; i<nLoggers; i++) {
	//loggers[i] = new GwLogger({ profileFn: "./enduroNetworkTest.json" });
	// Either the one-liner above, OR the following can be used here.
	
	loggers[i] = new GwLogger("OFF", false, true, "./logfiles/enduro.log");
	loggers[i].setMaxLogSizeKb(500);
	loggers[i].setMaxNumRollingLogs(5);
	loggers[i].setRollingLogPath("./rolledfiles");
	loggers[i].setIsRollBySize(true);
	loggers[i].setIsRollAtStartup(true);
	loggers[i].setArchiveLogPath("./rolledfiles/rolledfiles2");
	loggers[i].setArchiveLogPath(null);	
	loggers[i].setIsRollAsArchive(true);


	/*
	* // May use the three lines below either way, optional
	*/
	//loggers[i].setSepCharFile("%");
	loggers[i].setModuleName("Logger_"+i);
	loggers[i].setLogLevel("info");
}

/*
 *	Test to ensure log is recorded in proper order.
 *	Examines current and rolled logfiles to ensure logging during
 *	rolling didn't lose data or get it out-of-order. Runs at end of
 *  all testing, so only uses snapshot of rolled logfiles that 
 *  exist at that time.
*/
const test_seqConfirm = function(n, iters, fn, rollingLogPath
		, nMaxLogs, maxKb ) {
	nTests++;
	const fnPath = path.parse(fn);
	const estLines25k = 160; // 160 lines, n=180, is about 25K
	const fileLinesEst = (maxKb + 3) / 25 * estLines25k;
	let nFilesEst = Math.floor(iters / fileLinesEst);
	let logContents, logFn, nStr, nOld =-1, nNum=0, nStart=0, nEnd=0
	, nPrevFirstName=-1, nFirstNum=-1, failXFileSeq = false
	, failIntraFileSeq = false;
	tlog.info("In test_seqConfirm, estimated number of files:",nFilesEst
		, "(MaxNumRollingLogs set at:", nMaxLogs+")");
	if (nFilesEst > nMaxLogs) nFilesEst = nMaxLogs;
	try {
		for (let i=0; i<=nFilesEst; i++) {
			if (i===0) {
				logFn = fn;
			} else {
				logFn = rollingLogPath + "/" + fnPath.name + "_" 
							+ (""+i).padStart(3,0) + fnPath.ext; 
			}
			tlog.info("Start logfile #",i, logFn);
			logContents = fs.readFileSync(logFn ,"UTF-8");
			nStart=0, nEnd=0;
			// Will compare prev pg 1stNum to current pg lastNum
			nFirstNum = -1;
			do {
				nStart = logContents.indexOf(", n=", nStart);
				nEnd = logContents.indexOf("...,", nStart+2);
				if (nEnd > nStart+12 || nEnd < nStart) {
					continue;
				}
				nStr = logContents.substr(nStart + 4, nEnd - nStart - 4);
				nNum = parseInt(nStr);
				if (nFirstNum < 0) {
					nFirstNum = nNum;
				}
				if (nOld>-1 && nOld + 1 !== nNum) {
					tlog.notice("failure in file sequence: ", nOld, nNum, logFn);
					failIntraFileSeq = true;
				}
				nOld = nNum;
				nStart = nEnd + 1;				
			} while(nStart > -1 && nEnd > -1);
			
			if (nPrevFirstName > 0 && nOld !== nPrevFirstName - 1) {
					tlog.notice("File Sequence Failure: ", nOld, nPrevFirstName
						, logFn);
				failXFileSeq = true;
			}
			nPrevFirstName = nFirstNum;
			nOld = -1;
			
		}
		if (!failIntraFileSeq && !failXFileSeq) {
			nPassed++;
			tlog.notice("test_seqConfirm Passed!");
		} else 	tlog.notice("test_seqConfirm failed.");
					
	} catch(err) {
		throw(err);
	}
};


let heapInfo = v8.getHeapStatistics();
const startNativeContexts = heapInfo.number_of_native_contexts;

// Longer-running test near top-speed, check for memory leaks.
const test_enduro = function(n, iters) {
	let result = "";
	if (n < iters && test_enduro_pass) {
		if (n % 100 === 0) showPercentage("Test: test_enduro"
			, Math.round(n/iters*100));		
		if (n % 1000 === 0) {			
			try {
				heapInfo = v8.getHeapStatistics();
				if (heapInfo.number_of_detached_contexts > 0) {
					tlog.error("Heap Error: heapInfo.number_of_detached_contexts "
						+ "is > 0, is: ", heapInfo.number_of_detached_contexts);
					tlog.error("ERROR: Possible memory leak indicated, "
						+ "number_of_detached_contexts");
					test_enduro_pass = false;
				}
				if (heapInfo.number_of_native_contexts > startNativeContexts) {
					tlog.error("Heap Error: heapInfo.number_of_native_contexts "
						+ "is larger, is: ", heapInfo.number_of_native_contexts);
					tlog.error("ERROR: Possible memory leak indicated, "
						+ "number_of_native_contexts");
					test_enduro_pass = false;
				}
				tlog.info("At n=", n, ", nDelays=", nDelays, ", heap stats:\n"
					,v8.getHeapStatistics());					
			} catch(err) {
				console.error("test_enduro failed...");	
				test_enduro_pass = false;
				tlog.notice("\nTotalEnduroGwLogger.js Tests: " + nTests 
					+ ", Tests Passed: " + nPassed + "\n\n");			
			}
		}
		setTimeout(function() {
			n++;
			let delayDelta = 2;
			let iLog = getRandomInt(nLoggers);
			try {
				let b1 = loggers[iLog].info("logger:", iLog
					, ", timeout log, n=",n, "..., *".padEnd(95, "*"));
				if (!b1) {
					nDelays++;
					// Extend delay if buffer over high water mark, 
					// or rolling logfiles, etc.						
					delay = delay + delayDelta; 
				} else {
					if (delay > 0) tlog.info("Cancelling delay, back to zero. "
						+ "n is: ",n, ", Progress: ",Math.round(n/iters*100),"%");
					delay = 0;
				}
				if (!test_enduro_pass) tlog.info("test_enduro_pass is false, "
					+ "still going");
			} catch(err) {
				tlog.error(" test_enduro logging failed, n=",n
					, ", error is: \n", err);
				test_enduro_pass = false;
				tlog.notice("\nTotal EnduroGwLogger.js Tests: " + nTests 
					+ ", Tests Passed: " + nPassed + "\n\n");
			}
			test_enduro(n, iters);
		}, delay);
	} else {
		if (test_enduro_pass) {				
			nPassed++;
			tlog.notice("test_enduro passed, and no memory leaks were detected.");
			result = "Passed";
		} else {
			tlog.notice("test_enduro failed!");
			result = "Failed";
		}
		tlog.info(v8.getHeapStatistics());
		tlog.notice("At end, nDelays=",nDelays
			, ", heap stats:\n",v8.getHeapStatistics());
		tlog.notice("test_enduro is complete. The test " + result);
		
		test_seqConfirm(nStart, nIterations, loggers[0].getFn()
			, loggers[0].getRollingLogPath()
			, loggers[0].getMaxNumRollingLogs(), loggers[0].getMaxLogSizeKb() );
		console.log("Time Stopped: ", timeStoppedMs = Date.now());
		console.log("Total ms is: ", timeStoppedMs - timeStartedMs);
		tlog.notice("\nTotal EnduroGwLogger.js Tests: " + nTests 
			+ ", Tests Passed: " + nPassed + "\n\n");		
	}
};

test_getVersion();
nTests++;
const nStart = 0;
let timeStoppedMs;
const timeStartedMs = Date.now();
console.log("Time Started: ", timeStartedMs);
let test_enduro_pass = true, nDelays = 0, delay = 0;
const nIterations = 50000;
test_enduro(nStart, nIterations);



