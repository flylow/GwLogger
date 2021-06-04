"use strict";
/*global require */ // A directive for exceptions to ESLint no-init rule

const GwLogger = require("../GwLogger").GwLogger;
const path = require("path");
let assert;
assert = require("assert").strict;
if (!assert) assert = require("assert"); // for node < 10.0 without strict mode
// -- end of require section

const versionRef = "1.5.4"; // version number of targeted GwLogger.

const tlog = new GwLogger("notice", true, true
	, "./logfiles/Unit Test Results.log");
tlog.setModuleName("UT_03");
tlog.notice("===> UnitTestsGwLogger_03.js is running, results logfile "
	+ "is: ./logfiles/Unit Test Results.log");
	

const showStackTrace = true;
let nTests = 0; // # of tests attempted
let nPassed = 0;

function replacer(key, value) {
  // Filtering out properties
  if (key === "gwWriteStream" || key === "loggerId") {
    return undefined;
  }
  return value;
}

// UT_01 tests all source versions, so this only needs to test any one source.
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

// Here is a set of profile data to use as expectation for Environment Variables. 
// Settings must be different from built-in defaults and from GwLogger.json 
// profile file to be useful as a test case.
let jsonEnvTest = {
	"fn": "./logfiles/EnvTest.log",
	"logLevelStr": "FATAL",
	"isFile": false,
	"isConsole": true,
	"isColor": true,
	"isEpoch": false,
	"isLocalTz": false,	
	"nYr": 1,
	"isShowMs": false,
	"isConsoleTs": true,
	"isRollAsArchive": false,
	"isRollAtStartup": true,
	"isRollBySize": false,
	"maxLogSizeKb": 0, 
	"maxNumRollingLogs": 0, 
	"rollingLogPath": path.resolve("./rolledfiles/rolledfiles2"),
	"archiveLogPath": null
};

// --- This test requires preparation of setting environment variables that match 
// jsonEnvTest above. Hence, it is separate from other tests to allow prep before 
// and clean-up after (by .bat or .bash).
// Test the function that loads profile data from environment variables.	
const test_getEnvProfile = function() {
	nTests++;
	try {
		let profiles;
		// get a clean logger that creates new profile using env vars
		const logTest_Profile = new GwLogger(); 
		profiles = logTest_Profile.getProfilesInstance();		
		tlog.setLogLevel("notice");
		let jsonEnvTestStr = JSON.stringify(jsonEnvTest, replacer, 2);
		let jsonReturn = profiles.getActiveProfile(); // get current settings
		let jsonReturnStr = JSON.stringify(jsonReturn, replacer, 2);
		jsonReturn = JSON.parse(jsonReturnStr);
		jsonEnvTest = JSON.parse(jsonEnvTestStr); // round-trips for all.
		tlog.debug("---- jsonEnvTestStr, jsonReturnStr ------------");
		tlog.debug("In UT_03 comparing: ", JSON.stringify(jsonEnvTest, null, 2) 
			+ "\n" + JSON.stringify(jsonReturn, null, 2));
		tlog.debug("---- END END jsonEnvTestStr, jsonReturnStr ------------");
		assert.deepStrictEqual(jsonEnvTest, jsonReturn); 
		tlog.info("test_createActiveProfile Passed!");
		nPassed++;
	} catch(err) {
		tlog.error("Fail TESTING: test_getEnvProfile");
		if (showStackTrace) tlog.error(err);
	}
};
	
test_getVersion();
test_getEnvProfile();
tlog.notice("\nTotal UnitTestsGwLogger_03 Tests: " 
	+ nTests + ", Tests Passed: " + nPassed + "\n\n");


