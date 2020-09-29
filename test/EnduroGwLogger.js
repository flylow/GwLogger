"use strict";
/*global console, setTimeout, require */ // A directive for exceptions to ESLint no-init rule

const GwLogger = require("../GwLogger").GwLogger;
let assert;
assert = require("assert").strict;
if (!assert) assert = require("assert"); // for node < 10.0 without strict mode
// -- end of require section

const versionRef = "1.1.1"; // set to target version of GwLogger for test of getVersion method.
const showStackTrace = true;

const tlog = new GwLogger("notice", true, true, "./logfiles/Unit Test Results.log");
tlog.notice("-----------------------------  Enduro Testing Begins -----------------------------------------------");
tlog.setModuleName("Enduro");
tlog.notice("===> EnduroGwLogger.js is running, logfile is: ./logfiles/Unit Test Results.log");
	
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

// log to my usb drive (slow)
//const log2 = new GwLogger("debug", false, true, "D:\\logfiles\\happy.log");
//let isPath = log2.setRollingLogPath("D:\\rolledfiles\\rolledfiles2");

// log to my printer's very slow thumb drive (slowest)
//const log2 = new GwLogger("debug", false, true, "\\\\Epsonb87c8a\\memorycard\\sharedStuff\\logfiles\\happy.log");
//let isPath = log2.setRollingLogPath("\\\\Epsonb87c8a\\memorycard\\sharedStuff\\logfiles\\rolledLogs");

// log to my ssd, very fast
const log2 = new GwLogger("debug", false, true, "./logfiles/happy.log");
let isPath = log2.setRollingLogPath("./rolledfiles");

if (!isPath) {
	console.error("Path does not exist");
	throw("Cannot continue, rolling log path does not exist");
}
tlog.setLogLevel("notice");
log2.setMaxLogSizeKb(1000);
log2.setMaxNumRollingLogs(20);
log2.setIsRollBySize(true); // must be last setting change :)


let n = 500, test_enduro_pass = true, nDelays = 0, delay = 0;
const v8 = require("v8");
let heapInfo = v8.getHeapStatistics();
const startNativeContexts = heapInfo.number_of_native_contexts;
tlog.notice("At start, heap stats:\n",heapInfo);
const primeBlitz = () => {
	for (let i=0; i < n; i++) {
		let bufferOk = log2.info("i = ", i, ", *".padEnd(95, "*") );
		if (!bufferOk) {
			//console.log("test is Buffering, i="+i, ", buffer size is: ", log2.getWritableLengthKb(), ", isQueuing is: ", log2.getIsQueuing()+", IsRolling: "+log2.getIsRolling());
		}
	}
	console.log("Done with primeBlitz, buffer size is: ", log2.getWritableLengthKb(), ", isQueuing is: ", log2.getIsQueuing()+", IsRolling: "+log2.getIsRolling());
	
};

// Longer-running test near top-speed, check for memory leaks.
const test_enduro = function(n, iters) {
	let result = "";
	if (n < iters && test_enduro_pass) {
		if (n % 50000 === 0) {
			try {
				heapInfo = v8.getHeapStatistics();
				if (heapInfo.number_of_detached_contexts > 0) {
					tlog.error("Heap Error: heapInfo.number_of_detached_contexts is > 0, is: ", heapInfo.number_of_detached_contexts);
					tlog.error("ERROR: Possible memory leak indicated, number_of_detached_contexts");
					test_enduro_pass = false;
				}
				if (heapInfo.number_of_native_contexts > startNativeContexts) {
					tlog.error("Heap Error: heapInfo.number_of_native_contexts is larger, is: ", heapInfo.number_of_native_contexts);
					tlog.error("ERROR: Possible memory leak indicated, number_of_native_contexts");
					test_enduro_pass = false;
				}
				tlog.notice("At n=",n,", nDelays=",nDelays,", heap stats:\n",v8.getHeapStatistics());					
			} catch(err) {
				console.error("test_enduro failed...");	
				test_enduro_pass = false;
				tlog.notice("\nTotalEnduroGwLogger.js Tests: " + nTests + ", Tests Passed: " + nPassed + "\n\n");			
			}
		}
		setTimeout(function() {
			n++;
			let delayDelta = 2;
			try {
				let b1 = log2.info("timeout log, n=",n, "..., *".padEnd(95, "*"));
				if (!b1) {
					nDelays++;
					delay = delay + delayDelta; // extend delay if buffer over high water mark, or rolling logfiles, etc.
					//if (delay % 20 === 0) console.log("Extended delay MS:",delay, ", stream buffer size: ", log2.getWritableLengthKb()+"K, IsQueuing: "+log2.getIsQueuing()+", IsRolling: "+log2.getIsRolling());
				} else {
					if (delay > 0) console.log("Cancelling delay, back to zero. n is: ",n, ", Progress: ",Math.round(n/iters*100),"%");
					delay = 0;
				}
				if (!test_enduro_pass) console.log("test_enduro_pass is false, still going");
			} catch(err) {
				console.error(" test_enduro logging failed, n=",n, ", error is: \n", err);
				test_enduro_pass = false;
				tlog.notice("\nTotal EnduroGwLogger.js Tests: " + nTests + ", Tests Passed: " + nPassed + "\n\n");
			}
			test_enduro(n, iters);
		}, delay);
	} else {
		if (test_enduro_pass) {				
			nPassed++;
			tlog.notice("test_enduro passed");
			result = "Passed";
		} else {
			tlog.notice("test_enduro failed!");
			result = "Failed";
		}
		console.log(v8.getHeapStatistics());
		tlog.notice("At end, nDelays=",nDelays, ", heap stats:\n",v8.getHeapStatistics());
tlog.notice("test_enduro is complete. The test " + result);			
		tlog.notice("\nTotal EnduroGwLogger.js Tests: " + nTests + ", Tests Passed: " + nPassed + "\n\n");			
	}
};

test_getVersion();
primeBlitz(); // make sure there's something in the log2 logfile
nTests++;
const nIterations = 500000;
test_enduro(0, nIterations);


	