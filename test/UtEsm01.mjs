"use strict";
// UtEsm01.mjs  -- for test of ES6 import syntax

import sa from "assert";
import gwl from "../GwLogger.js";
import profiles from "../Profiles.js";

const assert = sa.strict;
const GwLogger = gwl.GwLogger;

/*
const GwLogger = require("../GwLogger").GwLogger;
const profiles = require("../Profiles.js");
let assert;
assert = require('assert').strict;
if (!assert) assert = require('assert'); // for node < 10.0 without strict mode
*/

const versionRef = "1.00"; // set to target version of GwLogger for test of getVersion method.
	
const tlog = new GwLogger("info", true, true, "./logfiles/logJsonFile.log");
tlog.setModuleName("UtEsm01");
tlog.notice("\n\n===> UtEsm01.mjs is running");
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
}

test_getVersion();

tlog.notice("\nTotal UtEsm01.mjs Unit Tests: " + nTests + ", Tests Passed: " + nPassed + "\n\n");
	
	