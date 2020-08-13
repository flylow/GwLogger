"use strict";

/*
// ------------   If using import (file must be renamed .mjs) -----------------
import sa from "assert";
import gwl from "../GwLogger.js";
import profiles from "../Profiles.js";

const assert = sa.strict;
const GwLogger = gwl.GwLogger;
// -- end of import section
*/

// ------------   If using require (file must be renamed .mjs) -----------------
const GwLogger = require("../GwLogger").GwLogger;
const profiles = require("../Profiles.js");
let assert;
assert = require('assert').strict;
if (!assert) assert = require('assert'); // for node < 10.0 without strict mode
// -- end of require section


const versionRef = "1.01"; // version number of targeted GwLogger.

const tlog = new GwLogger("info", true, true, "./logfiles/logJsonFile.log");
tlog.info("===> UnitTestsGwLogger_03.js is running");
tlog.setModuleName("UT_03");

const showStackTrace = true;
let nTests = 0; // # of tests attempted
let nPassed = 0;

function replacer(key, value) {
  // Filtering out properties
  if (key === "gwWriteStream") {
    return undefined;
  }
  return value;
}

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
}

// Here is a set of profile data to use as expectation for Environment Variables. Settings must 
// be mostly different from built-in defaults and from GwLogger.json profile file.
let jsonEnvTest = {
  "fn": "./logfiles/EnvTest.log",
  "logLevelStr": "FATAL",
  "isFile": false,
  "isConsole": true,
  "isLocalTz": false,  
  "nYr": 1,
  "isEpoch": false,  
  "isShowMs": false,
  "isConsoleTs": true  
};
	

// --- This test requires preparation of setting environment variables that match jsonEnvTest above. Hence, it is
// separate from other tests to allow prep before and clean-up after (by .bat or .bash).
// Test the function that loads profile data from environment variables.	
const test_getEnvProfile = function() {
	nTests++;
	try {
		let jsonEnvProfile = profiles.getEnvProfile(); 
		tlog.debug("In UT_03, jsonEnvProfile is: " + JSON.stringify(jsonEnvProfile, null, 2));
		let jsonEnvTestStr = JSON.stringify(jsonEnvTest, replacer, 2); // hides huge gwWriteStream from compare, which varies every time.
		let jsonReturn = profiles.getActiveProfile(); // try to get a copy of current settings
		let jsonReturnStr = JSON.stringify(jsonReturn, replacer, 2); // hide gwWriteStream prior to comparison
		jsonReturn = JSON.parse(jsonReturnStr);
		jsonEnvTest = JSON.parse(jsonEnvTestStr); // round-trips for all.
		tlog.debug("---- jsonEnvTestStr, jsonReturnStr ------------");
		tlog.debug(JSON.stringify(jsonEnvTest, null, 2) + "\n" + JSON.stringify(jsonReturn, null, 2));
		tlog.debug("---- END END jsonEnvTestStr, jsonReturnStr ------------");
		assert.deepStrictEqual(jsonEnvTest, jsonReturn); // Compare what is stored with what we expected
		tlog.info("test_createActiveProfile Passed!");
		nPassed++;
	} catch(err) {
		tlog.error("Fail TESTING: test_getEnvProfile");
		if (showStackTrace) tlog.error(err);
	}
}
	

test_getEnvProfile();
tlog.notice("\nTotal UnitTestsGwLogger_03 Tests: " + nTests + ", Tests Passed: " + nPassed + "\n\n");


