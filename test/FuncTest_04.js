"use strict";
console.log("****************     starting FT_04 **************************");
/*
import { GwLogger } from "../GwLogger.js";
*/

const GwLogger = require("../GwLogger").GwLogger;

/*
// Implement the old require function, and try it out!
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const path = require("path");
let p = path.parse("/code/gwlogger/myfile.log");
console.log("path is: ", p);
*/

/**
* This test helps test formatted output. It requires manual inspection after the run to ensure
* logging was correct. It uses sample logging statements that any user might want to use.
* All log entries should appear on both console and logfile.
*/
function replacer(key, value) {
  // Filtering out properties
  if (key === "gwWriteStream") {
    return undefined;
  }
  return value;
}
let log;
try {
	log = new GwLogger(); //"trace", true, true, "./happydir/nolog.log"); //"./logfiles/logJsonFileTmp.log"); // 
} catch(err) {
	console.error("Error in FuncTest_04",err);
	process.exit(1);
}
log.setIsConsole(true); 
log.setIsFile(true);
log.setIsConsoleTs(false);
log.setIsLocalTz(true);
log.setLogLevel("all");
log.notice(" ====>  now in beginning of FuncTest_04.js");

log.notice("\n\
This test helps test formatted output. It requires manual inspection after the run to ensure \
logging was correct. It uses sample logging statements that any user might want to use. \
All log entries should appear on both console and logfile.\n")

let sampleObj = {str: "This is a string", arr: ["this", "Object's","array", "has", "a", "number", 242], EmbObj: {objType: "embedded object", testing: "good one, eh?", aFunc: replacer}, bool: true, endNum: 666};
let sampleArray = ["this", "is", "a", "simple", "Array", 45.6];
let complexArray = ["this", "is", "a", "complex", "Array", {objType: "embedded object2", testing: "good one, eh?", num: 666}, "the end", 666];
log.setLogLevel("info");

log.info("1. This base message should be logged. The logLevel is now:" + log.getLogLevel());
log.info("2. The GwLogger version is: " + GwLogger.getVersion());

log.notice("The next three log statements are sample Obj, sample Array, and complex Array, solo for each log entry.");
log.info(sampleObj);
log.info(sampleArray);
log.info(complexArray);

log.notice("Now to include an ending string after the sample Obj");
log.info(sampleObj, "an ending string");

log.notice("Now use a simple intro string, and add a fourth, compound Obj.");
log.info("a sample Object:", sampleObj);
log.info("a sample Array:", sampleArray);
log.info("a complex Array:", complexArray);
log.info("The compound log statement:", sampleObj,sampleArray,complexArray,sampleObj);

log.notice("Repeat simple intro string, with fourth, compound Obj, but use error level.");
log.error("a sample Object:", sampleObj);
log.error("a sample Array:", sampleArray);
log.error("a complex Array:", complexArray);
log.error("The compound log statement:", sampleObj,sampleArray,complexArray,sampleObj);

let mda = [["a0", "a1","a2"], ["b0", "b1", "b2"]];
log.notice("Next, a multi-dimensional array:");
log.info("The MDA is:",mda);

log.notice("Finally, logging a user-defined function.");
log.info("\n",replacer);

log.notice("\nThis is the end of FuncTest_04. ");

