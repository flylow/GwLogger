"use strict";

/*
// ------------   If using import (file must be renamed .mjs) -----------------
import sa from "assert";
import gwl from "../GwLogger.js";

const assert = sa.strict;
const GwLogger = gwl.GwLogger;
// -- end of import section
*/

// ------------   If using require (file must be renamed .mjs) -----------------
const GwLogger = require("../GwLogger").GwLogger;
let assert;
assert = require('assert').strict;
if (!assert) assert = require('assert'); // for node < 10.0 without strict mode
// -- end of require section

const showStackTrace = true;
let nTests = 0; // # of tests attempted
let nPassed = 0;
let log = new GwLogger("ALL", true, false); // note that isFile (3rd arg) is false, no logging to logfile!
log.setModuleName("FT_01");
log.notice("\n====> FuncCon_01 \n");

// Test case to check proper logging with loglevel=off, or =all and isConsole=false.
const test_logLevelLogging = function() {	
	try {
		log.notice("In FuncTestCon_01.js, showing test file name after loglevel!\n \
This test group requires a manual assist. A log-level is set and then a log statement is\n \
made at each possible log level. A person must ensure that the correct statements\n \
were logged, and none of the incorrect ones.\n \
An important component of this test file is to verify that none of the\n \
logging tests should create a logfile. This is to ensure that logging to file\n \
is well acquiesced.\n \
Check that the logfile does not contain log statements from FuncCon_01 at: " + log.getFn() + "\n \
To make this easier to spot, all the log statements in this test file show the name 'FT_01' \n\n\
Test 1: Loglevel (LL)=ALL, should log the statement to console for\n\
all statement levels, but none to file.");

		let msg = "Logging in test_logLevelLogging at Level: ";
		log.fatal(msg + " 1");
		log.error(msg + " 2");
		log.warn(msg + " 3");
		log.notice(msg + " 4");
		log.info(msg + " 5");
		log.dev(msg + " 6");
		log.debug(msg + " 7");
		log.trace(msg + " 8");
		
		console.log("\nTest 2: LL=OFF, should log NO statements to console or file for any levels");
		log.setLogLevel("OFF");
		msg = "This should NOT be logged, logging is turned off now.";
		log.fatal(msg + " 1");
		log.error(msg + " 2");
		log.warn(msg + " 3");
		log.notice(msg + " 4");
		log.info(msg + " 5");
		log.dev(msg + " 6");
		log.debug(msg + " 7");
		log.trace(msg + " 8");

		console.log("\nTest 3: LL=ALL, but isConsole=false and isFile=false so should\n \
log nothing for any level");		
		msg = "This should NOT be logged to console, logging to console and file is turned off now."
		log.setLogLevel("ALL");	
		log.setIsConsole(false);
		log.fatal(msg + Date.now());
		log.error(msg + Date.now());
		log.warn(msg + Date.now());
		log.notice(msg + Date.now());
		log.info(msg + Date.now());
		log.dev(msg + Date.now());
		log.debug(msg + Date.now());
		log.trace(msg + Date.now());	

		console.log("\nTest 4: LL=ALL, isConsole set to true, log all statement levels to console, none to file.");		
		msg = "Logging AGAIN in test_logLevelLogging at: ";		
		log.setIsConsole(true);
		log.setLogLevel("ALL");	
		log.fatal(msg + " 1");
		log.error(msg + " 2");
		log.warn(msg + " 3");
		log.notice(msg + " 4");
		log.info(msg + " 5");
		log.dev(msg + " 6");
		log.debug(msg + " 7");
		log.trace(msg + " 8");	
		
	} catch(err) {
		console.info("ERROR TESTING: test_logLevelLogging");
		if (showStackTrace) console.log(err);
	}
}


test_logLevelLogging();
/*
log.setLogLevel("ALL");
log.setIsFile(true);
log.notice(" The four tests have completed. The fifth test task is to ensure \n\
that no logging from FuncTestCon_01 appears in logfile (named earlier).\n");
log.notice(" ---------  FuncTestCon_01.js is OVER, now will begin FuncTest_02.js\n\n");
*/
