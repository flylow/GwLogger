"use strict";
/*global console, setTimeout, require */ // A directive for exceptions to ESLint no-init rule

const GwLogger = require("../GwLogger").GwLogger;
const path = require("path");
const existsSync = require("fs").existsSync;
const unlinkSync = require("fs").unlinkSync;
let assert;
assert = require("assert").strict;
if (!assert) assert = require("assert"); // for node < 10.0 without strict mode
// -- end of require section

const versionRef = "1.1.1"; // set to target version of GwLogger for test of getVersion method.

const tlog = new GwLogger("notice", true, true, "./logfiles/Unit Test Results.log");
tlog.notice("-----------------------------  Unit Testing Begins -----------------------------------------------");
tlog.setModuleName("UT_04");
tlog.notice("===> UnitTestsGwLogger_04.js is running, logfile is: ./logfiles/Unit Test Results.log");

const showPercentage = function(msg, percentage){
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`${msg} ${percentage}%...`);
};
	
const showStackTrace = true;
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

const log2_logfile = "./logfiles/happy.log";
const log2_rollfiles = "./rolledfiles";

const log2 = new GwLogger("debug", false, true, log2_logfile);
log2.setMaxLogSizeKb(10);
log2.setMaxNumRollingLogs(3);
log2.setRollingLogPath(log2_rollfiles);
log2.setIsRollBySize(true);

const test_maxLogSize = function() {
	nTests++;
	try {
	assert.equal(true, log2.getIsRollBySize());
	log2.setMaxLogSizeKb(24);
	assert.equal(24, log2.getMaxLogSizeKb());
	assert.equal(false, log2.getIsRollBySize());
	log2.setIsRollBySize(true);
	nPassed++;
	tlog.info("test_maxLogSize Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_maxLogSize: ");
		if (showStackTrace) tlog.error(err);
	}
};

const test_maxNumRollingLogs = function() {
	nTests++;
	try {
	assert.equal(true, log2.getIsRollBySize());
	assert.ok(6 !== log2.getMaxNumRollingLogs());
	log2.setMaxNumRollingLogs(6);
	assert.equal(6, log2.getMaxNumRollingLogs());
	assert.equal(false, log2.getIsRollBySize());
	log2.setIsRollBySize(true);
	nPassed++;
	tlog.info("test_maxNumRollingLogs Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_maxNumRollingLogs: ");
		if (showStackTrace) tlog.error(err);
	}
};

const log2PathA = path.resolve(log2_rollfiles);
const test_rollPath = function() {
	nTests++;
	try {
	assert.equal(true, log2.getIsRollBySize());
	assert.ok(log2.getRollingLogPath() === log2PathA);
	let log2PathB = path.resolve("./rolledfiles/rolledfiles2");
	log2.setRollingLogPath("./rolledfiles/rolledfiles2");
	assert.ok(log2.getRollingLogPath() === log2PathB);
	assert.equal(false, log2.getIsRollBySize());
	log2.setIsRollBySize(true);
	nPassed++;
	tlog.info("test_rollPath Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_rollPath: ");
		if (showStackTrace) tlog.error(err);
	}
};

const test_isRollBySize = function() {
	nTests++;
	try {
	assert.equal(true, log2.getIsRollBySize());
	log2.setIsRollBySize(false);
	assert.equal(false, log2.getIsRollBySize());
	log2.setIsRollBySize(true);
	nPassed++;
	tlog.info("test_isRollBySize Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_isRollBySize: ");
		if (showStackTrace) tlog.error(err);
	}
};

const test_RollingLogsViaProfile = function() {	
	nTests++;
	try {
		let log = new GwLogger( { profileFn: "./GwLogger_Profile Param Test Log.json" } );
		let maxNumRollingLogs = log.getMaxNumRollingLogs();
		assert.ok(maxNumRollingLogs === 9, "getMaxNumRollingLogs = 9 failed (from object-profile)");
		log.setMaxNumRollingLogs(11);
		maxNumRollingLogs = log.getMaxNumRollingLogs();
		assert.ok(maxNumRollingLogs === 11, "test_set/getMaxNumRollingLogs = 11 failed"); 
		nPassed++;
		tlog.info("test_RollingLogsViaProfile Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_RollingLogsViaProfile");
		if (showStackTrace) tlog.error(err);
	}
};

//
// Test what happens if something or someone deletes a logfile while we're logging to it.
// If there is no exception thrown, we call that a 'pass', but that is really a smoke-test.
//
// Better, GwLogger should quickly notice the missing logfile and recreate it. The recreated logfile
// should not lose too many post-unlink logging statements.
// Unfortunately, the entire logfile that was deleted is, well, gone forever.

let n = 50, test_recovery_pass = true;
const primeBlitz = () => {
	for (let i=0; i < n; i++) {
		log2.info("i = ", i, ", *".padEnd(95, "*") );
	}	
};
const test_recovery = function(n, iters, isFileDelete) {
		if (n < iters && test_recovery_pass) {
			//if (isFileDelete) console.log("isFileDelete, n=",n);
			if (n % 100 === 0) showPercentage("Test: test_recovery", Math.round(n/iters*100));
			if ((isFileDelete) && (n % 1000 === 0)) { 
				try {
					if (existsSync(log2_logfile)) {
						log2.info("UNLINKing/deleting log file in test_recovery <<<<<<<<<<<<<<<");
						unlinkSync(log2_logfile);
						// the next logged itemis invariably lost, unlinking likely happens after this one is logged during following timeout
						log2.info("Completed UNLINKing/deleting log file in test_recovery <<<<<<<<<<<<<<<");
						console.log("Completed UNLINKing/deleting log file in test_recovery, n is: ", n, ", <<<<<<<<<<<<<<<");
					} else {
						n = n - 10; // ensures file exists before unlinking
					}
				} catch(err) {
					console.error("test_recovery Unlink failed...\n", err);	
					test_recovery_pass = false;
					tlog.notice("\nTotal UnitTestsGwLogger_04.js Unit Tests: " + nTests + ", Tests Passed: " + nPassed + "\n\n");			
				}
			}
			setTimeout(function() {
				n++;
				try {
					if (n===1 && isFileDelete) { log2.info("Recovered from file delete"); }
					log2.info("timeout log, n=",n, "..., *".padEnd(95, "*"));
					if (!test_recovery_pass) console.log("test_recovery_pass is false, still going");
				} catch(err) {
					console.error(" test_recovery logging failed, n=",n, ", error is: \n", err);
					test_recovery_pass = false;
					tlog.notice("\nTotal UnitTestsGwLogger_04.js Unit Tests: " + nTests + ", Tests Passed: " + nPassed + "\n\n");
				}
				test_recovery(n, iters, isFileDelete);
			}, 20 + (n * 0));
		} else {
			if (!isFileDelete) {
				test_recovery(n, n + 50, true);
			}
			else if (test_recovery_pass) {				
				nPassed++;
				tlog.info("test_recovery passed");
				tlog.notice("\nTotal UnitTestsGwLogger_04.js Unit Tests: " + nTests + ", Tests Passed: " + nPassed + "\n\n");
			}
		}
};
tlog.setLogLevel("info");
test_getVersion();
test_maxLogSize();
test_maxNumRollingLogs();
test_rollPath();
test_isRollBySize();
test_RollingLogsViaProfile();

tlog.setLogLevel("info");
log2.setMaxLogSizeKb(100);
log2.setMaxNumRollingLogs(20);
log2.setRollingLogPath("./logfiles");
log2.setIsRollBySize(true);
primeBlitz(); // make sure there's something in the log2 logfile
nTests++;
const nIterations = 2000;
const onePercent = Math.round(nIterations/100);
test_recovery(0, nIterations, false);


	