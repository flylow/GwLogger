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
const existsSync = require("fs").existsSync;
const unlinkSync = require("fs").unlinkSync;
let assert;
assert = require('assert').strict;
if (!assert) assert = require('assert'); // for node < 10.0 without strict mode
// -- end of require section

try {
	unlinkSync("./logfiles/logJsonFile.log"); // out with the old
} catch(err) { // noop
}

const versionRef = "1.00"; // version number of targeted GwLogger.
	
const tlog = new GwLogger("info", true, true, "./logfiles/logUT_02.log");
tlog.setModuleName("UT_02");
tlog.info("===> UnitTestsGwLogger_02.js is running, logfile is: ./logfiles/logUT_02.log");
	
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

const test_creationStories = function() {
	nTests++;
	try {
	const loggerTest1 = new GwLogger(); // smoke test 1, should NOT create log file
	const fn = loggerTest1.getFn();
	assert.ok(fn === "./logfiles/logJsonFile.log"); // ensure deleted correct one
	console.log("-------------------> Creation Stories profile matches ok");
	let isLogExists = existsSync(fn);
	assert.ok(!isLogExists);
	console.log("-------------------> Creation Stories #1 ok, new log file was Not created");
	loggerTest1.setLogLevel("ALL"); // should create logfile since loglevel no longer "OFF"
	loggerTest1.setIsFile(true);
	loggerTest1.setIsConsole(true);
	loggerTest1.info("Hello from UnitTestsGwLogger_02, test_creationStories");
	isLogExists = existsSync(fn);
	assert.ok(isLogExists);
	nPassed++;
	tlog.info("test_creationStories Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_creationStories: ");
		if (showStackTrace) tlog.error(err);
	}	
}

// Here is a set of profile data to use in test_getJsonProfile. Must be same as test/GwLogger.json!!!
let jsonDefTest2 = {
	"fn": "./logfiles/logJsonFile.log",
	"logLevelStr": "OFF",
	"isFile": true,
	"isConsole": false,
	"isConsoleTs": false,
	"isEpoch": false,
	"nYr": 0,
	"isLocalTz": true,
	"isShowMs": true
	};

// Test the function that loads profile data from GwLogger.json profile.	
const test_getJsonProfile = function() {
	nTests++;
	try {
		let jsonDefTestStr = JSON.stringify(jsonDefTest2, replacer, 2); // hides huge gwWriteStream from compare, which varies every time.
		jsonDefTest = JSON.parse(jsonDefTestStr);
		//console.log("jsonDefTest2 is: ", jsonDefTest2);
		let jsonReturn = profiles.getActiveProfile(); // try to get a copy of current settings
		//console.log("jsonReturn:",jsonReturn);
		let jsonReturnStr = JSON.stringify(jsonReturn, replacer, 2); // hide gwWriteStream prior to comparison
		jsonReturn = JSON.parse(jsonReturnStr);
		//console.log("---- jsonDefTest2, jsonReturn ------------");
		//console.log(jsonDefTest, "\n",jsonReturn);
		//console.log("---- END END jsonDefTest2, jsonReturn ------------");		
		assert.deepStrictEqual(jsonDefTest2, jsonReturn); // Compare what is stored with what we expected
		tlog.info("test_getJsonProfile Passed!");
		nPassed++;
	} catch(err) {
		tlog.error("Fail TESTING: test_getJsonProfile");
		if (showStackTrace) tlog.error(err);
	}
} 

// Here is a set of profile data to use in tests below
let jsonDefTest = {
	"fn": "./logfiles/logTest.log",
	"logLevelStr": "ERROR",
	"isFile": true,
	"isConsole": true,
	"isConsoleTs": false,
	"isEpoch": false,
	"nYr": 0,
	"isLocalTz": true,
	"isShowMs": true
	};
	
// Test the function that saves new profile data.	
const test_createActiveProfile = function() {
	nTests++;
	try {
		profiles.createActiveProfile(jsonDefTest); // save the test data
		let jsonDefTestStr = JSON.stringify(jsonDefTest, replacer, 2); // hides huge gwWriteStream from compare, which varies every time.
		let jsonReturn = profiles.getActiveProfile(); // try to get a copy of current settings
		let jsonReturnStr = JSON.stringify(jsonDefTest, replacer, 2); // hide gwWriteStream prior to comparison
		assert.deepStrictEqual(jsonDefTestStr, jsonReturnStr); // Compare what is stored with what we expected
		tlog.info("test_createActiveProfile Passed!");
		nPassed++;
	} catch(err) {
		tlog.error("Fail TESTING: test_createActiveProfile");
		if (showStackTrace) tlog.error(err);
	}
}

// Tests the function that converts the user's requested log level to an integer value.
// Conversion should not be case-sensitive, and should correctly return the numeric level 0-9.
// Function should recognize and reject non-existent log levels.
const test_Str2NumLogLevel = function() {
	nTests++;
	try {
		let logLevelNum = profiles.Str2NumLogLevel("		OFf  ");
		assert.deepStrictEqual(0, logLevelNum);
		logLevelNum = profiles.Str2NumLogLevel("		fAtaL		  ");
		assert.deepStrictEqual(1, logLevelNum);	

		logLevelNum = profiles.Str2NumLogLevel("		Error		  ");
		assert.deepStrictEqual(2, logLevelNum);	
		logLevelNum = profiles.Str2NumLogLevel("		Warn		  ");
		assert.deepStrictEqual(3, logLevelNum);	
		logLevelNum = profiles.Str2NumLogLevel("		notice		  ");
		assert.deepStrictEqual(4, logLevelNum);	
		logLevelNum = profiles.Str2NumLogLevel("		inFo		  ");
		assert.deepStrictEqual(5, logLevelNum);	
		logLevelNum = profiles.Str2NumLogLevel("		dEv		  ");
		assert.deepStrictEqual(6, logLevelNum);	
		logLevelNum = profiles.Str2NumLogLevel("		debug		  ");
		assert.deepStrictEqual(7, logLevelNum);	
		logLevelNum = profiles.Str2NumLogLevel("		traCe		  ");
		assert.deepStrictEqual(8, logLevelNum);		
		logLevelNum = profiles.Str2NumLogLevel("		AlL		  ");
		assert.deepStrictEqual(9, logLevelNum);	

		logLevelNum = profiles.Str2NumLogLevel("		XAlLX		  ");
		assert.notDeepStrictEqual(9, logLevelNum);	
		logLevelNum = profiles.Str2NumLogLevel("		XfAtaLX		  ");
		assert.deepStrictEqual(-1, logLevelNum);			
		tlog.info("test_Str2NumLogLevel Passed!");
		nPassed++;
	} catch(err) {
		tlog.error("Fail TESTING: test_Str2NumLogLevel");
		if (showStackTrace) tlog.error(err);
	}
	
}

// Tests the function that generates and formats timestamps. A lot of detail herein.
//getTimeStamp(tsFormat)
const test_getTimeStamp = function() {
	nTests++;
	let ts;
	let timeStampFormat = {};
	timeStampFormat.isEpoch = true; // timestamps will be milliseconds since 1/1/1970 UTC
	timeStampFormat.isLocalTz = true; // use local time (if false, will use UTC)
	timeStampFormat.isShowMs = true; // show the milliseconds?
	timeStampFormat.nYr = 0; // number of digits to show for the year in timestamps 0-4	
	try {
		ts = GwLogger.getTimeStamp(timeStampFormat)
		let testTs = Date.now();
		assert.ok(typeof ts === "number" && ts > 1594568938531 && testTs >= ts); // the number is an epoch TS from an earlier time than the test
		tlog.info("Epoch subtest passed");
		timeStampFormat.isEpoch = false;
		timeStampFormat.isLocalTz = false;
		ts = GwLogger.getTimeStamp(timeStampFormat);
		assert.ok(ts.endsWith("z"));
		tlog.info("Switch to Zulu time passed, ts is: ", ts);
		assert.ok(ts.length === 19, "Diff # of chars in zulu ts");
		tlog.info("Length of zulu time passed with nYr=0, ts is: ", ts);
		timeStampFormat.isLocalTz = true;
		ts = GwLogger.getTimeStamp(timeStampFormat);
		assert.ok(!ts.endsWith("z"));
		tlog.info("Switch to local time passed, ts is: ", ts);
		assert.ok(ts.length === 18, "Diff # of chars in local ts");
		tlog.info("Length of local time passed with nYr=0, ts is: ", ts);
		timeStampFormat.nYr = 2;
		ts = GwLogger.getTimeStamp(timeStampFormat);
		assert.ok(ts.length === 21, "Diff # of chars with nYr=2 in local ts");
		tlog.info("Length of local time passed with nYr=2, ts is: ", ts);
		timeStampFormat.nYr = 4;
		timeStampFormat.isLocalTz = true;
		timeStampFormat.isShowMs = false;
		ts = GwLogger.getTimeStamp(timeStampFormat);
		assert.ok(ts.length === 19, "Diff # of chars with nYr=2 in local ts");
		tlog.info("Length of local time passed with nYr=4, no MS, ts is: ", ts);
		tlog.info("Overall testing of getTimeStamp passed!");
		nPassed++;
		
	} catch(err) {
		tlog.error("Fail TESTING: test_test_getTimeStamp");
		if (showStackTrace) tlog.error(err);
	}
	
}

// Test the function that evaluates file names for a new profile.
// This should fail and hit the catch
const test_profileFileNameErrors = function() {
	tlog.info("The next test, test_profileFileNameErrors, should throw an error!!");
	let bkup_profiles;
	nTests++;
	try {
		let fn = "./bogus/XXdirectoryXX/myLogFile.log"; // A non-existant directory
		bkup_profiles = profiles.getProfileData(); //profiles.getGwWriteStream(); // save the existing 
		profiles.deleteProfileData();
		profiles.newProfileWriteStream(fn);
		profiles.setProfileData(bkup_profiles);  // restore
		tlog.error("Fail TESTING: test_profileFileNameErrors");
	} catch(err) {
		profiles.setProfileData(bkup_profiles); // profiles.setGwWriteStream(bkup_ws); // restore old writestream
		tlog.info("test_profileFileNameErrors Passed!");
		nPassed++;
	}
}

// Test the function that evaluates file names for a custom logfile.
// This should fail and hit the catch
const test_customFileNameErrors = function() {
	tlog.info("The next test, test_customFileNameErrors, should throw an error!!");
	nTests++;
	try {
		let fn = "./bogus/XXdirectoryXX/myLogFile.log"; // A non-existant directory
		profiles.newCustomWriteStream(fn);	
		tlog.error("Fail TESTING: test_customFileNameErrors"); // shouldn't get here
	} catch(err) {
		tlog.info("test_customFileNameErrors Passed!");
		nPassed++;
	}
}

// Test that the pool returns the same stream for two distinct custom loggers, as long as using the same logfile.
const test_customStreamPools = function() {
	let logger = new GwLogger("trace", true, true, "./logfiles/logJsonFile.log"); // same logfile as tlog.
	nTests++;
	try {
		let streamTlog = profiles.newCustomWriteStream("./logfiles/logJsonFile.log");
		let streamLogger = profiles.newCustomWriteStream("./logfiles/logJsonFile.log");
		assert.deepStrictEqual(streamTlog, streamLogger); 
		tlog.info("test_customStreamPools Passed! process.cwd()=", process.cwd());
		nPassed++;
	} catch(err) {
		tlog.error("Fail TESTING: test_customStreamPools");
		if (showStackTrace) tlog.error(err);
	}
}



test_getVersion();
test_creationStories();
test_getJsonProfile();

// Prep for tests that target saved profile and default settings
// setSavedDefaults does not allow overwrites, so we must go to the global and delete the previously saved data.
	profiles.deleteProfileData();
test_createActiveProfile();
test_Str2NumLogLevel();
test_getTimeStamp();
test_profileFileNameErrors();
test_customFileNameErrors();
test_customStreamPools();


tlog.notice("\nTotal UnitTestsGwLogger_02.js Unit Tests: " + nTests + ", Tests Passed: " + nPassed+"\n\n");


