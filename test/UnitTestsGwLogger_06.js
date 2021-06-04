"use strict";
/*global console, require */ 
const fs = require("fs");
const existsSync = require("fs").existsSync;
const promisify = require("util").promisify;
const renameProm = promisify(fs.rename);
const unlinkProm = promisify(fs.unlink);
const writeFileProm = promisify(fs.writeFile);

const GwLogger = require("../GwLogger").GwLogger;
let assert;
assert = require("assert").strict;
if (!assert) assert = require("assert"); // for node < 10.0 without strict mode
// -- end of require section

const versionRef = "1.5.4"; // set to target version of GwLogger
const showStackTrace = true;
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

// Define Unit Test logger
const tlog = new GwLogger("notice", true, "true"
	, "./logfiles/Unit Test Results.log");
tlog.setModuleName("UT_06");
tlog.setIsFile(true);
tlog.notice("===> UnitTestsGwLogger_06.js is running, results logfile is: "
	, tlog.getFn()); //./logfiles/Unit Test Results.log

// Here is a set of 'good' profile data to use in tests below
const validProf = {
	"fn": "./logfiles/ut_06.log",
	"logLevelStr": "off",
	"isFile": true,
	"isConsole": false,
	"isConsoleTs": false,
	"isEpoch": false,
	"nYr": 0,
	"isLocalTz": true,
	"isShowMs": false,
	"isRollBySize": false,
	"maxLogSizeKb": 0, 
	"maxNumRollingLogs": 0, 
	"rollingLogPath": null,
	"isRollAtStartup": false,
	"isRollAsArchive": false,
	"archiveLogPath": null
};

// future victim of test abuses
let gwLoggerJsonTest = Object.assign({}, validProf);

// Set of 'bad' values to plug into profile json for tests
const tcs = {
	"fn": "./logfilesXXX/ut_06.log",
	"logLevelStr": "offXXX",
	"isFile": "never",
	"isConsole": "never",
	"isConsoleTs": "never",
	"isEpoch": "never",
	"nYr": 5,
	"isLocalTz": "never",
	"isShowMs": "never",
	"isRollBySize": "never",
	"maxLogSizeKb": -20, 
	"maxNumRollingLogs": "never", 
	"rollingLogPath": "./nowhereXXX",
	"isRollAtStartup": "never",
	"isRollAsArchive": "never",
	"archiveLogPath": "./nowhereXXX"
};

// rename existing profile file, if it exists
const renameProfile = async function(fn, newfn) {
	if (existsSync(newfn)) {
		const error = new Error("renameProfile cannot write over existing file: " + newfn);
		throw error;		
	}
	if (existsSync(fn)) {
		await renameProm(fn, newfn);
		//console.log("renameProfile renamed file: ", fn);
		return true;
	} else {
		console.log("renameProfile did not find the file: ", fn);
		return false;
	}
};

const writeNewProfile = async function(fn, profileObj) {
	if (existsSync(fn)) {
		const error = new Error("writeNewProfile cannot write over existing file: " + fn);
		throw error;
	}
	const profileStr = JSON.stringify(profileObj, null, 4);
	await writeFileProm(fn, profileStr, "utf-8");
	//console.log("writeNewProfile done");
};

const mvGwLoggerJson = async function() {
	try {
		let n = 0;
		let result = await renameProfile("./GwLogger.json", "./GwLoggerBkp.json");
		while (result === true && existsSync("./GwLogger.json")) {
			console.log("killing time to ensure GwLogger.json is moved safely ", ++n);
		}
		return true;
	} catch(err) {
		console.log("error: ", err);
	}		
};

const restoreGwLoggerJson = async function() {
	try {
		if (existsSync("./GwLoggerBkp.json") && existsSync("./GwLogger.json")) {
			await unlinkProm("./GwLogger.json");
		}
		let n = 0;		
		while (existsSync("./GwLogger.json")) {
			console.log("killing time to ensure old test GwLogger.json is deleted ", ++n);
		}		
		n = 0;
		let result = await renameProfile("./GwLoggerBkp.json", "./GwLogger.json");
		while (result === true && existsSync("./GwLoggerBkp.json")) {
			console.log("killing time to ensure GwLoggerBkp.json is renamed safely ", ++n);
		}		
		return true;
	} catch(err) {
		console.log("error: ", err);
	}		
};


let failedKeys = [];

const runTc = async function(key, isAcc) {
	let log;
	nTests++;
	let goodValue = gwLoggerJsonTest[key];	
	gwLoggerJsonTest[key] = tcs[key]; // inject erroneous value
	//console.log("key is: ", key, ", test value is: ", gwLoggerJsonTest[key]);
	await writeNewProfile("./GwLogger.json", gwLoggerJsonTest);	
	try {
		log = new GwLogger();
		tlog.error("Test failed for key of: ", key, ", isAcc is: ", isAcc);
		nFail++;
		failedKeys.push(key);
	} catch(err) {
		if (isAcc && err.errorList.length > oldErrorListLen) {
			nPassed++;
			tlog.info("Passed test with key = ", key, ", test value = ", gwLoggerJsonTest[key]);
		} else if (!isAcc) {
			nPassed++;
			tlog.info("Passed test with key = ", key, ", test value = ", gwLoggerJsonTest[key]);
		} else {
			nFail++;
			failedKeys.push(key);
			tlog.error("Test failed for key of: ", key, ", test value = ", gwLoggerJsonTest[key]);
		}
		oldErrorListLen = err.errorList.length;
		//console.log("oldErrorListLen is: ", oldErrorListLen);
	} finally {
		if (!isAcc) gwLoggerJsonTest[key] = goodValue; // don't accumulate errors, restore good value
		if (existsSync("./GwLogger.json")) {
			await unlinkProm("./GwLogger.json");
		}
		while (existsSync("./GwLogger.json")) {
			console.log("killing time to ensure old test GwLogger.json is deleted ", ++n);
		}		
		
		let n = 0;		
		while (existsSync("./GwLogger.json")) {
			console.log("killing time to ensure old test GwLogger.json is deleted ", ++n);
		}			
	}
};

// Test adds an error to config profile at each pass, 
// one-at-a-time (acc=0) or accumulating errors (acc=1)
const testProfileConfig = async function() {
	await mvGwLoggerJson();	// move GwLogger.json out of harm's way	
	try {
		for (let acc=0; acc<2; acc++) {
			oldErrorListLen = 0;
			for (let key in tcs) { // tcs has the incorrect attribute values
				if (Object.hasOwnProperty.call(tcs, key)) {	
					await runTc(key, acc);
				}
			}
		}			
	} catch(err) {
		console.log("Unexpected/unwanted Error in runTests: ", err);
	} finally {
		await restoreGwLoggerJson();
			tlog.notice("\nTotal UnitTestsGwLogger_06.js Unit Tests: " + nTests 
				+ ", Tests Passed: " + nPassed+ ", Tests Failed: ", nFail + "\n\n");
			if (nFail > 0) tlog.notice("List of failed keys: ", failedKeys);		
	}
		
};

		

let nFail = 0, nTests=0, nPassed=0, oldErrorListLen = 0, accMsg = [];
accMsg[0] = "Single value replacement";
accMsg[1] = "Inject errors without replacement (accumulative)";

const runTests = async function() {
	test_getVersion();
	await testProfileConfig();	
};

runTests();

