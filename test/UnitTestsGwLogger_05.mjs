"use strict";
// UnitTestsGwLogger_05.mjs  -- for test of ES6 import syntax

import sa from "assert";
import gwl from "../GwLogger.js";

const assert = sa.strict;
const GwLogger = gwl.GwLogger;


const versionRef = "1.4.0"; // set to target version of GwLogger
	
const tlog = new GwLogger("notice", true, true
	, "./logfiles/Unit Test Results.log");
tlog.setModuleName("UT_05");
tlog.notice("===> UnitTestsGwLogger_05.mjs is running, results logfile is: "
	+ "./logfiles/Unit Test Results.log");

// Extra Startup API test (but manual verification)
const logger = new GwLogger("DEBUG", false, false
	, "./logfiles/Profile Param Test Log.log");
logger.setIsRollBySize(false);
logger.setMaxNumRollingLogs(5);
logger.setRollingLogPath("./rolledfiles");
logger.setIsRollAtStartup(true);
logger.setIsFile(true);
// did it roll the logfile?
	
const showStackTrace = true;
let nTests = 0; // # of tests attempted
let nPassed = 0;

// UT_01 tests all source versions, so this only needs to test any one source.
// Will test instance against static. Main thing is to ensure startup of logger.
const test_getVersion = function() {
	nTests++;
	try {
	const ver = GwLogger.getVersion(); // both static and instance methods exist
	const ver2 = tlog.getVersion(); // instance method
	assert.equal(ver, versionRef);
	assert.equal(ver, ver2);
	nPassed++;
	tlog.info("test_getVersion with ES6 Imports Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_getVersion: ");
		if (showStackTrace) tlog.error(err);
	}
};

test_getVersion();

tlog.notice("\nTotal UnitTestsGwLogger_05.mjs Unit Tests: " + nTests 
	+ ", Tests Passed: " + nPassed + "\n\n");
	
	