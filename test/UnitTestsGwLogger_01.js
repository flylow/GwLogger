"use strict";
/*global require */ // A directive for exceptions to ESLint no-init rule

/*
// ------------   If using import (file must be renamed .mjs) -----------------
import sa from "assert";
import gwl from "../GwLogger.js";

const assert = sa.strict;
const GwLogger = gwl.GwLogger;
// -- end of import section
*/

// ------------   If using require -----------------
const GwLogger = require("../GwLogger").GwLogger;
let assert;
assert = require("assert").strict;
if (!assert) assert = require("assert"); // for node < 10.0 without strict mode
// need to check version numbers in all source files
const { ProfileClass } = require("../Profiles");
const fsprom = require("../fsprom.js");
const timestamps = new (require("../timestamps.js")).Timestamps;
const writePool = require("../WritePool.js");
const FileRec = require("../FileRec.js").FileRec;
// -- end of require section

const versionRef = "1.5.5"; // set to target version of GwLogger	
const tlog = new GwLogger("off", true, "true"
	, "./logfiles/Unit Test Results.log");
tlog.setLogLevel("notice");
tlog.notice("-----------------------------  Unit Testing Begins "
	+ "-----------------------------------------------");
tlog.setModuleName("UT_01");
tlog.notice("===> UnitTestsGwLogger_01.js is running, results " 
	+ "logfile is: ./logfiles/Unit Test Results.log");

const showStackTrace = true;
let nTests = 0; // # of tests attempted
let nPassed = 0;

// Test version number of all source files.
const test_getVersion = function() {
	nTests++;
	try {
	let ver = GwLogger.getVersion();
	assert.equal(ver, versionRef, "Failed version check for GwLogger.js");
	ver = ProfileClass.getVersion();
	assert.equal(ver, versionRef, "Failed version check for Profile.js");
	ver = writePool.getVersion();
	assert.equal(ver, versionRef, "Failed version check for WritePool.js");
	ver = fsprom.getVersion();
	assert.equal(ver, versionRef, "Failed version check for fsprom.js");
	ver = timestamps.getVersion();
	assert.equal(ver, versionRef, "Failed version check for timestamps.js");
	ver = FileRec.getVersion();
	assert.equal(ver, versionRef, "Failed version check for FileRec.js");	
	nPassed++;
	tlog.info("test_getVersion Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: At least one source file version number does not match in test_getVersion: ");
		if (showStackTrace) tlog.error(err);
	}
};

const test_setIsEpoch = function() {
	nTests++;		
	try {
		let log = new GwLogger();
		log.setIsEpoch(true);
		let isEpoch = log.getIsEpoch();
		assert.ok(isEpoch === true, "set/getIsEpoch true failed");
		log.setIsEpoch(false);
		isEpoch = log.getIsEpoch();
		assert.ok(isEpoch === false, "set/getIsEpoch false failed"); 
		nPassed++;
		tlog.info("test_setIsEpoch passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_setIsEpoch");
		if (showStackTrace) tlog.error(err);
	}
};

const test_setIsShowMs = function() {	
	nTests++;
	try {
		let log = new GwLogger();
		log.setIsShowMs(true);
		let isShowMs = log.getIsShowMs();
		assert.ok(isShowMs === true, "set/getIsShowMs true failed");
		log.setIsShowMs(false);
		isShowMs = log.getIsShowMs();
		assert.ok(isShowMs === false, "set/getIsShowMs false failed"); 
		nPassed++;
		tlog.info("test_setIsShowMs passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_setIsShowMs");
		if (showStackTrace) tlog.error(err);
	}
};

const test_setIsLocalTz = function() {
	nTests++;
	try {
		let log = new GwLogger();
		log.setIsLocalTz(false);
		let isLocalTz = log.getIsLocalTz();
		assert.ok(isLocalTz === false, "set/getisLocalTz false failed");
		log.setIsLocalTz(true);
		isLocalTz = log.getIsLocalTz();
		assert.ok(isLocalTz === true, "test_set/getIsLocalTz true failed"); 
		nPassed++;
		tlog.info("test_setIsLocalTz Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_setIsLocalTz");
		if (showStackTrace) tlog.error(err);
	}
};

const test_setYearDigits = function() {
	nTests++;
	try {
		let log = new GwLogger();
		log.setYearDigits(0);
		let nYr = log.getYearDigits();
		assert.ok(nYr === 0, "set/getYearDigits true failed");
		log.setYearDigits(2);
		nYr = log.getYearDigits();
		assert.ok(nYr === 2, "set/getYearDigits false failed"); 
		nPassed++;
		tlog.info("test_setYearDigits passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_setYearDigits");
		if (showStackTrace) tlog.error(err);
	}
};

const test_setIsConsoleTs = function() {
	nTests++;
	try {
		let log = new GwLogger();
		log.setIsConsoleTs(false);
		let isConsoleTs = log.getIsConsoleTs();
		assert.ok(isConsoleTs === false, "set/getIsConsoleTs false failed");
		log.setIsConsoleTs(true);
		isConsoleTs = log.getIsConsoleTs();
		assert.ok(isConsoleTs === true, "test_set/getIsConsoleTs true failed"); 
		nPassed++;
		tlog.info("test_setIsConsoleTs passed");
	} catch(err) {
		tlog.error("Fail TESTING: test_setIsConsoleTs");
		if (showStackTrace) tlog.error(err);
	}
};

const test_setSepCharX = function() {	
	nTests++;
	try {
		let log = new GwLogger();
		log.setSepCharConsole("*");
		let sepChar = log.getSepCharConsole();
		assert.ok(sepChar === "*", "set/getSepCharConsole * failed");
		log.setSepCharConsole(" ");
		sepChar = log.getSepCharConsole();
		assert.ok(sepChar === " ", "set/getSepCharConsole ' ' (space) failed");
		
		log.setSepCharFile("*");
		sepChar = log.getSepCharFile();
		assert.ok(sepChar === "*", "set/getSepCharFile * failed");
		log.setSepCharFile(" ");
		sepChar = log.getSepCharFile();
		assert.ok(sepChar === " ", "set/getSepCharFile ' ' (space) failed");		
		nPassed++;		
		tlog.info("test_setSepCharX Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_setSepChar");
		if (showStackTrace) tlog.error(err);
	}
};

const test_setLogLevel = function() {
	nTests++;
	try {
		let log = new GwLogger();
		log.setLogLevel("tRacE");
		let logLevel = log.getLogLevel();
		assert.ok(logLevel === "TRACE", "set/getLogLevel * failed");
		log.setLogLevel("deBug");
		logLevel = log.getLogLevel();
		assert.ok(logLevel === "DEBUG", "set/setLogLevel ' ' (space) failed"); 
		nPassed++;
		tlog.info("test_setLogLevel Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_setLogLevel");
		if (showStackTrace) tlog.error(err);
	}
};

const test_setIsConsole = function() {	
	nTests++;
	try {
		let log = new GwLogger();
		log.setIsConsole(false);
		let isConsole = log.getIsConsole();
		assert.ok(isConsole === false, "set/getIsConsoleTs false failed");
		log.setIsConsole(true);
		isConsole = log.getIsConsole();
		assert.ok(isConsole === true, "test_set/getIsConsole true failed");
		nPassed++;
		tlog.info("test_setIsConsole Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_setIsConsole");
		if (showStackTrace) tlog.error(err);
	}
};

const test_setIsColor = function() {
	nTests++;
	try {
		let log = new GwLogger();
		log.setIsColor(false);
		let isColor = log.getIsColor();
		assert.ok(isColor === false, "set/getIsColor false failed");
		log.setIsColor(true);
		isColor = log.getIsColor();
		assert.ok(isColor === true, "test_set/getIsColor true failed");
		nPassed++;
		tlog.info("test_setIsColor Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_setIsColor");
		if (showStackTrace) tlog.error(err);
	}
};

const test_setIsFile = function() {	
	nTests++;
	try {
		let log = new GwLogger();
		log.setIsFile(false);
		let isFile = log.getIsFile();
		assert.ok(isFile === false, "set/getisLocalTz false failed");
		log.setIsFile(true);
		isFile = log.getIsFile();
		assert.ok(isFile === true, "test_set/getIsFile true failed"); 
		nPassed++;
		tlog.info("test_setIsFile Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_setIsFile");
		if (showStackTrace) tlog.error(err);
	}
};

// Tests that getFn can get a profile/default fn and also one set by constructor
const test_getFn = function() {	
	nTests++;
	try {
		let log = new GwLogger("WARN", false, false
			, "./logfiles/testLog4getFn.log");
		let fn = log.getFn();
		// This fn should equal the one passed in the args to create a new logger.
		assert.ok(fn === "./logfiles/testLog4getFn.log"
			, "getFn failed 1, fn="+fn); 
		let log2 = new GwLogger("ERROR", true, true);
		fn = log2.getFn();
		assert.ok(fn === "./logfiles/logJsonFile.log", "getFn failed 2, fn="+fn);
		nPassed++;
		tlog.info("test_getFn (both substests) Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_getFn");
		if (showStackTrace) tlog.error(err);
	}
};

test_getVersion();
test_setIsEpoch();
test_setIsShowMs();
test_setIsLocalTz();
test_setYearDigits();
test_setIsConsoleTs();	
test_setSepCharX();
test_setLogLevel();
test_setIsConsole();
test_setIsColor();
test_setIsFile();
test_getFn();

tlog.notice("\nTotal UnitTestsGwLogger_01.js Unit Tests: " 
	+ nTests + ", Tests Passed: " + nPassed + "\n\n");
	
	