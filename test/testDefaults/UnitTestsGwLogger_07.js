"use strict";
/*global require */ // A directive for exceptions to ESLint no-init rule
const GwLogger = require("../../GwLogger").GwLogger;
let assert;
assert = require("assert").strict;
if (!assert) assert = require("assert"); // for node < 10.0 without strict mode

const versionRef = "1.5.5"; // version number of targeted GwLogger.
const tlog = new GwLogger("notice", true, true
	, "../logfiles/Unit Test Results.log");
tlog.on("warn", (msgCode, msg) => {console.log("************** === code is", msgCode, ", msg is: ", msg);});	
tlog.setModuleName("UT_07");
tlog.notice("===> UnitTestsGwLogger_07.js is running, results logfile is: "
	, tlog.getFn()); //./logfiles/Unit Test Results.log
const showStackTrace = true;
	
let nTests = 0; // # of tests attempted
let nPassed = 0;

// Go look, ensure default logfile was created.
const existsSync = require("fs").existsSync;
const unlinkSync = require("fs").unlinkSync;
const fsprom = require("../../fsprom.js");

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

const test_defaults_1 = async function() {
	try {
		if (existsSync("./gwl_log.log")) {
			await fsprom.unlinkFile("./gwl_log.log"); // out with the old
		}
	} catch(err) { 
		console.log("Error in unlinkFile in UnitTestsGwLogger_07: ", err);
		throw err;
	}
	nTests++;
	try {
		let isLogExists = existsSync("./gwl_log.log");
		assert.ok(!isLogExists, "Previous logfile wasn't removed"); // verify disappearance

		// Create default logger
		const defLog1 = new GwLogger();
		defLog1.on("warn", (msgCode, msg) => {tlog.notice("************** In defLog1, code is", msgCode, ", msg is: ", msg);});
		
		assert.ok(defLog1.getLogLevel() === "OFF", "Loglevel was not default OFF");
		assert.ok(defLog1.getIsFile() === true, "isFile was not default true");
		assert.ok(defLog1.getIsConsole() === false, "isConsole was not default false");
		assert.ok(defLog1.getIsEpoch() === false, "isEpoch was not default false");
		assert.ok(defLog1.getYearDigits() === 0, "nYr was not default 0");
		assert.ok(defLog1.getIsLocalTz() === true, "isLocalTx was not default true");
		assert.ok(defLog1.getIsShowMs() === true, "isShowMs was not default true");
		assert.ok(defLog1.getIsRollAsArchive() === false, "issRollAsArchive was not default false");
		assert.ok(defLog1.getIsRollAtStartup() === false, "isRollAtStartup was not default false");
		assert.ok(defLog1.getIsRollBySize() === false, "isRollBySize was not default false");
		assert.ok(defLog1.getRollingLogPath() === null, "rollingLogPath was not default null");
		assert.ok(defLog1.getArchiveLogPath() === null, "archiveLogPath was not default null");
		assert.ok(defLog1.getMaxLogSizeKb() === 0, "maxLogSizeKb was not default 0");
		assert.ok(defLog1.getMaxNumRollingLogs() === 0, "maxNumRollingLogs was not default 0");
		
		//Change loglevel to "all"
		defLog1.setLogLevel("all");

		// Log a test statement, which should create default log file
		defLog1.info("Test logging to ensure default logfile is created");
		
		isLogExists = existsSync("./gwl_log.log");
		assert.ok(isLogExists, "Missing default log file ./gwl_log.log");
		

		nPassed++;
		tlog.info("test_defaults_1 Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_defaults: ");
		if (showStackTrace) tlog.error(err);
	}	
};
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
const wait4Que = async function(logger, iters=50) {
	if (!logger.getIsQueuing()) {
		return;
	}
	if (iters < 0) {
		console.log("In wait4Que, out of time...");
		return;
	}
	await sleep(200);
	await wait4Que(logger, --iters);
}

const test_defaults_2 = async function() {
	try {
		if (existsSync("./gwl_log.log")) {
			await fsprom.unlinkFile("./gwl_log.log"); // out with the old
		}
	} catch(err) { 
		console.log("Error in unlinkFile in UnitTestsGwLogger_07: ", err);
		throw err;
	}
	nTests++;
	try {
		let isLogExists = existsSync("./gwl_log.log");
		assert.ok(!isLogExists, "Previous logfile wasn't removed"); // verify disappearance

		// Create default logger
		const defLog2 = new GwLogger("all");
		defLog2.on("warn", (msgCode, msg) => {tlog.notice("**************In defLog2 code is", msgCode, ", msg is: ", msg);});
		
		assert.ok(defLog2.getLogLevel() === "ALL", "Loglevel was not set to ALL");
		assert.ok(defLog2.getIsFile() === true, "isFile was not default true");
		assert.ok(defLog2.getIsConsole() === false, "isConsole was not default false");


		// Log a test statement, which should create default log file
		defLog2.info("Test logging to ensure default logfile is created");
		defLog2.info("Test logging to ensure default logfile is created #2");
		
		await wait4Que(defLog2); // Must wait for any logger queue to be written before this test, since the logfile was deleted at runtime.
		isLogExists = existsSync("./gwl_log.log");		
		assert.ok(isLogExists, "Missing default log file ./gwl_log.log");
		

		nPassed++;
		tlog.info("test_defaults_2 Passed!");
	} catch(err) {
		tlog.error("Fail TESTING: test_defaults: ");
		if (showStackTrace) tlog.error(err);
	}	
};

const testRunner = async function() {
	test_getVersion();
	await test_defaults_1(); // test pure defaults. Set loglevel to ensure default logfile is created
	await test_defaults_2(); // test that default logfile is created with passed loglevel

	setTimeout(() => {tlog.notice("\nTotal UnitTestsGwLogger_07.js Unit Tests: " + nTests 
	+ ", Tests Passed: " + nPassed+"\n\n");}, 1000);
};
testRunner();