"use strict";
// UnitTestsGwLogger_05.mjs  -- for test of ES6 import syntax

import sa from "assert";
import gwl from "../GwLogger.js";

const assert = sa.strict;
const GwLogger = gwl.GwLogger;


const versionRef = "1.2.0"; // set to target version of GwLogger for test of getVersion method.
	
const tlog = new GwLogger("notice", true, true, "./logfiles/Unit Test Results.log");
tlog.setModuleName("UT_05");
tlog.notice("===> UnitTestsGwLogger_05.mjs is running, logfile is: ./logfiles/Unit Test Results.log");

// Startup API test
const logger = new GwLogger("DEBUG", false, false, "./logfiles/Profile Param Test Log.log");
logger.setIsRollBySize(false);
logger.setMaxNumRollingLogs(5);
logger.setRollingLogPath("./rolledfiles");
logger.setIsRollAtStartup(true);
//console.log("isRollAtStartup is: ", logger.getIsRollAtStartup());
//logger.setLogLevel("debug");
logger.setIsFile(true);
// did it roll the logfile?
	
const showStackTrace = true;
let nTests = 0; // # of tests attempted
let nPassed = 0;

// Included here to ensure we are testing correct version.
const test_getVersion = function() {
	nTests++;
	try {
	const ver = GwLogger.getVersion(); // static method actually holds version value
	const ver2 = tlog.getVersion(); // instance method will also call static method
	assert.equal(ver, versionRef);
	assert.equal(ver, ver2); // make sure both methods are working okay and the same.
	nPassed++;
	tlog.info("test_getVersion with ES6 Imports Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_getVersion: ");
		if (showStackTrace) tlog.error(err);
	}
};

test_getVersion();

tlog.notice("\nTotal UnitTestsGwLogger_05.mjs Unit Tests: " + nTests + ", Tests Passed: " + nPassed + "\n\n");
	
	