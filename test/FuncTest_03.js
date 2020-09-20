"use strict";

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

// -- end of require section

/**
* This test helps tests logging levels. It requires manual inspection after the run to ensure
* logging was correct at each level. It starts at the default (read from environment vars, json file or 
* built-ins), and then steps sequenctially through off, error, warn, info, debug, and trace.
*/
function replacer(key, value) {
  // Filtering out properties
  if (key === "gwWriteStream") {
    return undefined;
  }
  return value;
}

let log = new GwLogger();
log.setIsFile(true);
log.setIsConsole(true); 
log.setIsConsoleTs(false);
log.setIsLocalTz(true);
log.setLogLevel("all");

log.setLogLevel("info");
log.notice(" ====>  now in beginning of FuncTest_03.js");
log.info("1. This base message should be logged. The logLevel is now:" + log.getLogLevel());
log.info("2. The GwLogger version is: " + GwLogger.getVersion() + "   This version should be logged. ");


log.setLogLevel("info");
log.setModuleName("ModName");
log.info("3. The module name 'ModName' should now appear. \n \
The logLevel should be 'INFO', it is:" + log.getLogLevel());

log.info("The console separation character will next be changed to an ampersand '&'.");
log.setSepCharConsole("&");
log.info("4. This should be logged. The separation character is now:" + log.getSepCharConsole());
log.setSepCharConsole(" ");
log.info("5. This should be logged, the console separation char has returned to a space: ", log.getSepCharConsole());

log.setModuleName("");
log.info("6. The module name 'ModName' should now be removed.")

log.setIsConsoleTs(true); // turn on timestamps for console display
log.info("7. Does console now show a timestamp?");

log.setIsEpoch(true); // Switch logging to millisecond timestamps
log.info("8. Did this information get logged with Epoch MS timestamp?");

log.info("The console separation character will next be changed to a hash symbol '#'.");
log.setSepCharConsole("#");
log.info("9. This should be logged. The console (not logfile) separation character is now:" + log.getSepCharConsole());
log.setSepCharConsole(" ");
log.info("10. This should be logged, console sep char has returned to a space: ", log.getSepCharConsole());


log.setIsLocalTz(true);
log.setIsEpoch(false);
log.setYearDigits(0);
log.setLogLevel("info");
log.info("11. This should be logged local timezone without year. The logLevel is now:" + log.getLogLevel());

log.setIsLocalTz(true);
log.setYearDigits(4);
log.setLogLevel("info");
log.info("12. This should be logged with a 4-digit year. The logLevel is now:" + log.getLogLevel());

log.setYearDigits(2);
log.setLogLevel("info");
log.info("13. This should be logged with a 2-digit year. The logLevel is now:" + log.getLogLevel());

log.setIsEpoch(false);
log.setIsLocalTz(false);
log.setYearDigits(0);
log.setLogLevel("info");
log.info("14. This should be logged with UTC but no year. The logLevel is now:" + log.getLogLevel());

log.setIsEpoch(false);
log.setIsLocalTz(true);
log.setIsShowMs(false);
log.setYearDigits(0);
log.setLogLevel("info");
log.info("15. This should be logged with local time but no year or MS. The logLevel is now:" + log.getLogLevel());

log.info("The LOGFILE (not console) separation character will next be changed to a hash symbol ('#') and module name is 'myModule'.");
log.setSepCharFile("#");
log.setModuleName("myModule");
log.info("16. The logfile (not console) separation character is now:" + log.getSepCharFile());
log.setSepCharFile(" ");
log.setModuleName("");
log.info("17. The module name is removed, and the logfile sep char has returned to a space: ", log.getSepCharFile());


log.setLogLevel("trace");
log.trace("18. At end, logLevel is now:" + log.getLogLevel());

log.notice("\nThis is the end of FuncTest_03. ");

