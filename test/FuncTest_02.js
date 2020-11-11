"use strict";
console.log("****************     starting FT_02 **************************");
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

let nn = 0;
const n = function() {
	nn++;
	return "-" + nn + "- ";
}
let log = new GwLogger();


log.setLogLevel("all");
log.setIsConsole(true);
log.setIsFile(true);
log.setIsConsoleTs(true);
log.notice("\n ====>  now in beginning of FuncTest_02.js");
log.notice(" \n \
FuncTest_02 tests logging levels. It requires manual inspection after\n \
the run to ensure logging was correct at each level. It starts using the profile\n \
(read from json file, but with log level specified), and then steps\n\
sequenctially through off, error, warn, info, debug, and trace.\n \
Logging for rest of test file is to both console and file. \n\
Console timestamps are turned on, and logging should be verified identical for\n \
both file and console.\n");
let badLog = "  =========== ERROR ==============";

log.setLogLevel("notice");
log.notice("*********1. logLevel changing to: fatal");
log.setLogLevel("fatal");
log.setLogLevel("fatal");
log.fatal(n() + "Did this fatal get logged?\n");
log.error(badLog);
log.warn(badLog);
log.notice(badLog);
log.info(badLog);
log.dev(badLog);
log.debug(badLog);
log.trace(badLog);

log.setLogLevel("notice");
log.notice("*********2. logLevel changing to: error");
log.setLogLevel("error");
log.fatal(n() + "Did this fatal get logged?");
log.error(n() + "Did this error get logged?\n");
log.warn(badLog);
log.notice(badLog);
log.info(badLog);
log.dev(badLog);
log.debug(badLog);
log.trace(badLog);

log.setLogLevel("notice");
log.notice("*********3. logLevel changing to: warn");
log.setLogLevel("warn");
log.fatal(n() + "Did this fatal get logged?");
log.error(n() + "Did this error get logged?");
log.warn(n() + "Did this warning get logged?\n");
log.notice(badLog);
log.info(badLog);
log.dev(badLog);
log.debug(badLog);
log.trace(badLog);

log.setLogLevel("notice");
log.notice("*********4. logLevel changing to: notice");
log.setLogLevel("notice");
log.fatal(n() + "Did this fatal get logged?");
log.error(n() + "Did this error get logged?");
log.warn(n() + "Did this warning get logged?");
log.notice(n() + "Did this notice get logged?\n");
log.info(badLog);
log.dev(badLog);
log.debug(badLog);
log.trace(badLog);

log.setLogLevel("notice");
log.notice("*********5. logLevel changing to: info");
log.setLogLevel("info");
log.fatal(n() + "Did this fatal get logged?");
log.error(n() + "Did this error get logged?");
log.warn(n() + "Did this warning get logged?");
log.notice(n() + "Did this notice get logged?");
log.info(n() + "Did this information get logged?\n");
log.dev(badLog);
log.debug(badLog);
log.trace(badLog);

log.setLogLevel("notice");
log.notice("*********6. logLevel changing to: dev");
log.setLogLevel("dev");
log.fatal(n() + "Did this fatal get logged?");
log.error(n() + "Did this error get logged?");
log.warn(n() + "Did this warning get logged?");
log.notice(n() + "Did this notice get logged?");
log.info(n() + "Did this information get logged?");
log.dev(n() + "Did this dev get logged?\n");
log.debug(badLog);
log.debug(badLog);
log.trace(badLog);

log.setLogLevel("notice");
log.notice("*********7. logLevel changing to: debug");
log.setLogLevel("debug");
log.fatal(n() + "Did this fatal get logged?");
log.error(n() + "Did this error get logged?");
log.warn(n() + "Did this warning get logged?");
log.notice(n() + "Did this notice get logged?");
log.info(n() + "Did this information get logged?");
log.dev(n() + "Did this dev get logged?");
log.debug(n() + "Did this debug detail get logged?\n");
log.trace(badLog);

log.setLogLevel("notice");
log.notice("*********8. logLevel changing to: trace");
log.setLogLevel("trace");
log.fatal(n() + "Did this fatal get logged?");
log.error(n() + "Did this error get logged?");
log.warn(n() + "Did this warning get logged?");
log.notice(n() + "Did this notice get logged?");
log.info(n() + "Did this information get logged?");
log.dev(n() + "Did this dev get logged?");
log.debug(n() + "Did this debug detail get logged?");
log.trace(n() + "Did this trace data get logged?\n");

log.setLogLevel("notice");
log.notice("*********9. logLevel changing to: all");
log.setLogLevel("all");
log.fatal(n() + "Did this fatal get logged?");
log.error(n() + "Did this error get logged?");
log.warn(n() + "Did this warning get logged?");
log.notice(n() + "Did this notice get logged?");
log.info(n() + "Did this information get logged?");
log.dev(n() + "Did this dev get logged?");
log.debug(n() + "Did this debug detail get logged?");
log.trace(n() + "Did this trace data get logged?");

log.notice("\nThe last displayed logging statement should have been numbered: "+ nn + "\n \
If a statement appeared that was not numbered (except for\n \
loglevel status starting with '*'), then that indicates an issue. \n \
If numbers aren't in sequential order starting at '1', that's an issue.\n");

log.notice(" --------  Ending FuncTest_02.js");

