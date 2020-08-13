import { GwLogger } from "../GwLogger.js";

/**
* This test helps tests logging levels. It requires manual inspection after the run to ensure
* logging was correct at each level. It starts at the default (read from json file or 
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
log.setIsFile(false); 
log.setIsConsoleTs(true);
//log.setUseLocalTimezone(true);
log.fatal("At startup, logLevel is from json file or from built-in defaults is now: " + log.getLogLevel()+("\n"));
log.setLogLevel("all");
let json = log.getActiveProfile();
let LL = json.logLevelStr;
let isConsole = json.isConsole;
let isFile = json.isFile;
let fn = json.fn;
log.info(`At startup, the current defaults (from built-ins or from JSON profile) is: ${JSON.stringify(json,replacer,2)}`);

log.setLogLevel("off");
log.setIsFile(false);
log.fatal("***This should *NOT* be logged. The logLevel is now:" + log.getLogLevel());

log.setLogLevel("info");
log.info("This should be logged to console. The logLevel is now:" + log.getLogLevel());
log.info("The GwLogger version is: " + GwLogger.getVersion() + "   This version should be logged. ");

log.setSepChar("&");
log.info("This should be logged. The separation character is now:" + log.getSepChar());


log.setIsConsole(false); // turn off logging to console
log.info("**This should NOT be logged to console, only to file. Did this information get logged to console?");

log.setIsConsole(true);
log.setIsFile(false); // turn off logging to file
log.info("*This should NOT be logged to file, only to console. Did this information show on console, but not get logged to file?");


log.setIsFile(true); // logging everywhere now
log.setIsConsoleTs(true); // turn on timestamps for console display
log.info("This should be logged to both file and console. Does console now show a timestamp?");

log.setIsEpoch(true); // Switch logging to millisecond timestamps
log.info("Did this information get logged to console MS timestamp?");

log.setIsLocalTimezone(true);
log.setIsEpoch(false);
log.setYearDigits(0);
log.setLogLevel("info");
log.info("This should be logged local timezone without year. The logLevel is now:" + log.getLogLevel());
log.info("The GwLogger version is: " + GwLogger.getVersion() + "   This version should be logged. ");

log.setIsLocalTimezone(true);
log.setYearDigits(4);
console.log("yearDigits = ", log.getYearDigits());
log.setLogLevel("info");
log.info("This should be logged with a 2-digit year. The logLevel is now:" + log.getLogLevel());
log.info("The GwLogger version is: " + GwLogger.getVersion() + "   This version should be logged. ");


log.setIsEpoch(false);
log.setIsLocalTimezone(false);
log.setYearDigits(0);
log.setLogLevel("info");
log.info("This should be logged with UTC but no year. The logLevel is now:" + log.getLogLevel());
log.info("The GwLogger version is: " + GwLogger.getVersion() + "   This version should be logged. ");

log.setIsEpoch(false);
log.setIsLocalTimezone(true);
log.setIsShowMs(false);
log.setYearDigits(0);
log.setLogLevel("info");
log.info("This should be logged with local time but no year or MS. The logLevel is now:" + log.getLogLevel());
log.info("The GwLogger version is: " + GwLogger.getVersion() + "   This version should be logged. ");


log.setLogLevel("info");
log.info("At end, logLevel is now:" + log.getLogLevel());


