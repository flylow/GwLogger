"use strict";

// A directive for exceptions to ESLint no-init rule
/*global console, process, require */ 

const GwLogger = require("../GwLogger").GwLogger;
const existsSync = require("fs").existsSync;
const unlinkSync = require("fs").unlinkSync;
const path = require("path");
const fs = require("fs");
const getTimeStamp = require("../timestamps.js").getTimeStamp;
let profiles;
let assert;
assert = require("assert").strict;
if (!assert) assert = require("assert"); // for node < 10.0 without strict mode
// -- end of require section

const versionRef = "1.3.0"; // version number of targeted GwLogger.
	
const tlog = new GwLogger("notice", true, true
	, "./logfiles/Unit Test Results.log");
tlog.setModuleName("UT_02");
tlog.notice("===> UnitTestsGwLogger_02.js is running, results logfile is: "
	, tlog.getFn()); //./logfiles/Unit Test Results.log
	
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

const test_creationStories = function() {
	try {
		if (existsSync("./logfiles/logJsonFile.log")) {
			unlinkSync("./logfiles/logJsonFile.log"); // out with the old
		}
	} catch(err) { 
		console.log("Error in unlinkSync in UnitTestsGwLogger_02: ", err);
		throw err;
	}
	nTests++;
	try {
		let isLogExists = existsSync("./logfiles/logJsonFile.log");
		assert.ok(!isLogExists); // verify disappearance
		const loggerTest1 = new GwLogger();// should NOT create new log file (yet)
		const fn = loggerTest1.getFn();
		 // ensure we disappeared the correct one
		assert.ok(fn === "./logfiles/logJsonFile.log", "fn was: ", fn);
		isLogExists = existsSync(fn);
		assert.ok(!isLogExists);
		// now chg loglevel and enable logfile since loglevel no longer "OFF"
		loggerTest1.setLogLevel("info"); 
		loggerTest1.setIsFile(true); // final step to enable logfile creation.
		loggerTest1.setIsConsole(true);
		isLogExists = existsSync(fn);
		loggerTest1.debug("Hello from UnitTestsGwLogger_02, "
			+ "test_creationStories");
		
		
		assert.ok(isLogExists);
		let log4UT_04 = new GwLogger({
			profileFn: "./GwLogger_Profile Param Test Log.json" 
		});
		log4UT_04.setModuleName("UT_02");	
		log4UT_04.notice("log4UT_04 is created now to meet a dependency "
			+ "for a later test, UT_04's isRollAtStartup");
		nPassed++;
		tlog.info("test_creationStories Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_creationStories: ");
		if (showStackTrace) tlog.error(err);
	}	
};

// Here is a set of profile data to use in test_getJsonProfile. 
// Must be the same as current profile test/GwLogger.json!!!
let jsonDefTest2 = {
	"fn": "./logfiles/logJsonFile.log",
	"logLevelStr": "OFF",
	"isFile": true,
	"isConsole": false,
	"isColor": true,
	"isConsoleTs": false,
	"isEpoch": false,
	"nYr": 0,
	"isLocalTz": true,
	"isShowMs": true,
	"isRollAsArchive": false,
	"isRollAtStartup": false,
	"isRollBySize": true,
	"maxLogSizeKb": 20, 
	"maxNumRollingLogs": 9, 
	"rollingLogPath": path.resolve("./rolledFiles")
	};

// get a clean logger that reads this app's (test's) directory default 
// json profile, ./GwLogger.json
const logTest_Profile = new GwLogger(); 
profiles = logTest_Profile.getProfilesInstance(); // get this instance of profiles

// Test the function that loads profile data from GwLogger.json profile.	
const test_getJsonProfile = function() {
	nTests++;
	try {
		let jsonDefTestStr = JSON.stringify(jsonDefTest2, replacer, 2);
		jsonDefTest = JSON.parse(jsonDefTestStr);
		let jsonReturn = profiles.getActiveProfile(); // get current settings
		let jsonReturnStr = JSON.stringify(jsonReturn, replacer, 2);
		jsonReturn = JSON.parse(jsonReturnStr);
	// Compare what is stored with what we expected	
		assert.deepStrictEqual(jsonDefTest2, jsonReturn); 
		tlog.info("test_getJsonProfile Passed!");
		nPassed++;
	} catch(err) {
		tlog.error("Fail TESTING: test_getJsonProfile");
		if (showStackTrace) tlog.error(err);
	}
};
 
// Here is a set of profile data to use in tests below
let jsonDefTest = {
	"fn": "./logfiles/logUnitTestInstance.log",
	"logLevelStr": "error",
	"isFile": false,
	"isConsole": true,
	"isConsoleTs": false,
	"isEpoch": false,
	"nYr": 0,
	"isLocalTz": true,
	"isShowMs": false,
	"isRollBySize": false,
	"maxLogSizeKb": 0, 
	"maxNumRollingLogs": 0, 
	"rollingLogPath": null
	};
	
// Test the function that saves new profile data.	
const test_createActiveProfile = function() {
	nTests++;
	try {
		profiles.createActiveProfile(jsonDefTest); // save the test data
		let jsonDefTestStr = JSON.stringify(jsonDefTest, replacer, 2);
		let jsonReturnStr = JSON.stringify(jsonDefTest, replacer, 2);
		assert.deepStrictEqual(jsonDefTestStr, jsonReturnStr);
		tlog.info("test_createActiveProfile Passed!");
		nPassed++;
	} catch(err) {
		tlog.error("Fail TESTING: test_createActiveProfile");
		if (showStackTrace) tlog.error(err);
	}
};

// Tests the function that converts the user's requested log level to an 
// integer value for each log level. Conversion should not be case-sensitive, 
// and should correctly return the numeric level 0-9.
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
	
};

// Tests the function that generates and formats timestamps. 
// A lot of detail herein.
const test_getTimeStamp = function() {
	nTests++;
	let ts;
	let timeStampFormat = {};
	timeStampFormat.isEpoch = true; // timestamps will be MS since 1/1/1970 UTC
	timeStampFormat.isLocalTz = true; // use local time (if false, will use UTC)
	timeStampFormat.isShowMs = true; // show the milliseconds?
	timeStampFormat.nYr = 0; // number of digits for the year in timestamps, 0-4	
	timeStampFormat.sephhmmss = ":";
	try {
		let stats = fs.statSync("./logfiles/Unit Test Results.log");
		let ms = stats.mtimeMs; // last time file was modified
		ts = getTimeStamp(timeStampFormat);
		let testTs = Date.now();
		// the constant number is a TS from an definite earlier time than the test
		assert.ok(typeof ts === "number" && ts > 1594568938531 && testTs >= ts); 
		tlog.info("Epoch subtest passed");
		timeStampFormat.isEpoch = false;
		timeStampFormat.isLocalTz = false;
		ts = getTimeStamp(timeStampFormat);
		assert.ok(ts.endsWith("Z"));
		tlog.info("Switch to Zulu time passed, ts is: ", ts);
		assert.ok(ts.length === 19, "Diff # of chars in zulu ts");
		tlog.info("Length of zulu time passed with nYr=0, ts is: ", ts);
		timeStampFormat.isLocalTz = true;
		ts = getTimeStamp(timeStampFormat);
		assert.ok(!ts.endsWith("Z"));
		tlog.info("Switch to local time passed, ts is: ", ts);
		assert.ok(ts.length === 18, "Diff # of chars in local ts");
		tlog.info("Length of local time passed with nYr=0, ts is: ", ts);
		timeStampFormat.nYr = 2;
		ts = getTimeStamp(timeStampFormat);
		assert.ok(ts.length === 21, "Diff # of chars with nYr=2 in local ts");
		tlog.info("Length of local time passed with nYr=2, ts is: ", ts);
		timeStampFormat.nYr = 4;
		timeStampFormat.isLocalTz = true;
		timeStampFormat.isShowMs = false;
		ts = getTimeStamp(timeStampFormat);
		assert.ok(ts.length === 19, "Diff # of chars with nYr=2 in local ts");
		tlog.info("Length of local time passed with nYr=4, no MS, ts is: ", ts);
		tlog.info("Overall testing of getTimeStamp passed!");
		nPassed++;
		
	} catch(err) {
		tlog.error("Fail TESTING: test_test_getTimeStamp");
		if (showStackTrace) tlog.error(err);
	}
	
};

// Test the function that evaluates file names for a new profile.
// This should fail and hit the catch
const test_profileFileNameErrors = function() {
	tlog.info("Next, the test_profileFileNameErrors should throw an error!!");
	let bkup_profiles;
	nTests++;
	try {
		let fn = "./bogus/XXdirectoryXX/myLogFile.log"; // non-existant directory
		bkup_profiles = profiles.getProfileData(); // save the existing 
		profiles.deleteProfileData();
		profiles.newProfileWriteStream(fn);
		profiles.setProfileData(bkup_profiles);  // restore
		tlog.error("Fail TESTING: test_profileFileNameErrors");
	} catch(err) {
		profiles.setProfileData(bkup_profiles); // restore old writestream
		tlog.info("test_profileFileNameErrors Passed!");
		nPassed++;
	}
};

// Test the function that evaluates file names for a custom logfile.
// This should fail and hit the catch in order to pass the test
const test_customFileNameErrors = function() {
	tlog.info("The next test, test_customFileNameErrors, will throw an error!!");
	nTests++;
	try {
		let fn = "./bogus/XXdirectoryXX/myLogFile.log"; // non-existant directory
		profiles.newCustomWriteStream(fn);	
		tlog.error("Fail TESTING: test_customFileNameErrors");
	} catch(err) {
		tlog.info("test_customFileNameErrors Passed!");
		nPassed++;
	}
};

// Test that writepool returns the same stream for two distinct custom loggers, 
// as long as using the same logfile.
const test_customStreamPools = function() {
	let logger = new GwLogger("trace", false, true
		, "./logfiles/logJsonFile.log"); // same logfile as tlog.
	logger.trace("This logger named 'logger' from UT_02 exists only to ensure "
		+ "logJsonFile profile exists for test_customStreamPools test case.");
	nTests++;
	try {
		let streamTlog = 
			profiles.newCustomWriteStream("./logfiles/logJsonFile.log");
		let streamLogger 
			= profiles.newCustomWriteStream("./logfiles/logJsonFile.log");
		assert.deepStrictEqual(streamTlog, streamLogger); 
		tlog.info("test_customStreamPools Passed! process.cwd()=", process.cwd());
		nPassed++;
	} catch(err) {
		tlog.error("Fail TESTING: test_customStreamPools");
		if (showStackTrace) tlog.error(err);
	}
};

try {
	if (existsSync("./logfiles/logJsonFile.log")) {
		unlinkSync("./logfiles/logJsonFile.log"); // out with the old
	}
} catch(err) { 
	console.log("Error in unlinkSync in UnitTestsGwLogger_02: ", err);
	throw err;
}

test_getVersion();
test_creationStories();
test_getJsonProfile();

// Prep for tests that target saved profile and default settings.
// setSavedDefaults does not allow overwrites, so we must go to the profiles 
// class and delete the previously saved data.
profiles.deleteProfileData(); //Profiles methods are only test instrumentation

test_createActiveProfile();
test_Str2NumLogLevel();
test_getTimeStamp();
test_profileFileNameErrors();
test_customFileNameErrors();
test_customStreamPools();


tlog.notice("\nTotal UnitTestsGwLogger_02.js Unit Tests: " + nTests 
	+ ", Tests Passed: " + nPassed+"\n\n");


