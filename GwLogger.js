"use strict";
/** 
 * GwLogger : A small and simple-to-use Node.js logger that streams to file and/or console. 
 * There are no dev dependencies for GwLogger, but if you use Eslint please use the included
 * eslintrc.json profile.
 *
 * For user information, see README.MD at https://github.com/flylow/GwLogger
 * MIT license.
 * --G. Wilson, 5/2020
 */
 
/*global console, process, require, exports */ // A directive for exceptions to ESLint no-init rule
/*
import { writePool } from "./WritePool.js";
import { profiles } from "./Profiles.js";
import { inspect } from "util";
*/ 
const writePool = require("./WritePool.js"); //import { writePool } from "./WritePool.js";
const profiles = require("./Profiles");  //import { profiles } from "./Profiles.js";
const inspect = require("util").inspect; //import { inspect } from "util";

const version = "1.00";


class GwLogger {
	constructor(logLevelStr, isConsole, isFile, fn) {
		this.activeProfile = profiles.getActiveProfile(); // use these defaults as backdrop
		this.logLevels = ["OFF", "FATAL", "ERROR", "WARN", "NOTICE", "INFO", "DEV", "DEBUG", "TRACE", "ALL"];
		this.wsSources = {global: "global", custom: "custom"};
		if (profiles.isValidStr(logLevelStr)) {
			logLevelStr = logLevelStr.trim().toUpperCase();
		}
		if (!profiles.isValidStr(logLevelStr) || this.logLevels.findIndex(level => level === logLevelStr) < 0) {
			if (logLevelStr) { // typo or such. Post an error message. It's worse than nothing...
				let stack = this.getStackTrace(new Error());			
				console.error("\x1b[31m%s\x1b[0m", "ERROR: Log level must be one of: "  + this.logLevels.join()+"\n",stack);
				console.error("\x1b[31m%s\x1b[0m", ">>>> But, was given log level of: " + logLevelStr + " <<<<"); 
				console.error("\x1b[31m%s\x1b[0m", ">>>>After ERROR, will set to " + this.activeProfile.logLevelStr + " and try to continue.<<<<");
			}
			logLevelStr = this.activeProfile.logLevelStr;
			this.logLevel = this.logLevels.findIndex(level => level === logLevelStr);
		} else this.logLevel = this.logLevels.findIndex(level => level === logLevelStr);

		this.moduleName = ""; // short name/description of module or source file doing the logging (prints to log)
		this.timeStampFormat = {};
		this.timeStampFormat.isEpoch = this.activeProfile.isEpoch; // timestamps will be milliseconds since 1/1/1970 UTC
		this.timeStampFormat.isLocalTz = this.activeProfile.isLocalTz; // use local time (if false, will use UTC)
		this.timeStampFormat.isShowMs = this.activeProfile.isShowMs; // show the milliseconds?
		this.timeStampFormat.nYr = this.activeProfile.nYr; // number of digits to show for the year in timestamps 0-4
		this.sepCharFile = " "; // separator between parts of logged message. Can be a comma to assist DB storage/migration of logs.
		this.sepCharConsole = " "; // separator between parts of logged message to be fair to console.	
		this.depthNum = 2;
		this.isColor = true;
		this.isConsoleTs = this.activeProfile.isConsoleTs;
		
		this.isConsole = isConsole === undefined ? this.activeProfile.isConsole : isConsole;
		this.isFile = isFile === undefined ? this.activeProfile.isFile : isFile;
		this.fn = profiles.isValidStr(fn) ? fn.trim() : null;
		this.ucFn = this.fn ? this.fn.replace(/\s+/g, '').toUpperCase() : null;
		this.wsSource = (this.fn) 
			? this.wsSources.custom 
			: this.wsSources.global;
		if (this.wsSource === this.wsSources.global && this.activeProfile.fn 
				&& this.logLevel > 0 && this.isFile) {
			this.fn = this.activeProfile.fn;
			try {
				this.ensureWriteStream();
			} catch(err) {
				console.error("ERROR in GwLogger creating custom logfile", err);
				//let stack = this.getStackTrace(new Error());			
				//console.error("\x1b[31m%s\x1b[0m", "ERROR: Unlikely filename or other issue while creating a new logging file stream in GwLogger.\n",stack);				
				process.exit(1); // All stop (TODO, just log in the built-in default location instead of dying?)
			}
		}
		if (this.wsSource === this.wsSources.custom && this.fn && this.logLevel > 0 && this.isFile) {
			try {
				this.ensureWriteStream();
			} catch(err) {
				console.error("ERROR in GwLogger creating custom logfile:", err);
				process.exit(1); // All stop (TODO, just log in the default location instead of dying?)
			}
		} 		
	}
	
	getStackTrace(err) { // Trims stacktrace to point at perpetrator
		let stack = err.stack;
		stack = stack.split("\n").map(function (statement) { return statement.trim(); });
		return stack.splice(stack[0] == "Error" ? 2 : 1);		
	}
	
	setModuleName(mn) {		
		this.moduleName = mn.trim();
	}
	
	getModuleName() {
		return this.moduleName;
	}
	
	getVersion() {
		return GwLogger.getVersion();
	}
	
	static getVersion() { 
		return version;
	}

	static getTimeStamp(tsFormat) {
		if (tsFormat.isEpoch) return Date.now(); //UNIX Epoch in milliseconds since 1/1/1970 UTC
		
		let currentTime = new Date();
		if (tsFormat.year === 4 && tsFormat.isShowMs) { //2020-07-10T20:56:33.291Z (24 chars)
			return currentTime.toISOString();
		}
		
		const padZero = "0";	
		let yr = tsFormat.isLocalTz ? (currentTime.getFullYear()).toString() : (currentTime.getUTCFullYear()).toString();
		
		let month = tsFormat.isLocalTz ? (currentTime.getMonth() + 1).toString() : (currentTime.getUTCMonth() + 1).toString();
		month = month.padStart(2, padZero);

		let dayOfMonth = tsFormat.isLocalTz ? currentTime.getDate().toString() : currentTime.getUTCDate().toString();
		dayOfMonth = dayOfMonth.toString().padStart(2, padZero);

		let hours = tsFormat.isLocalTz ? currentTime.getHours().toString() : currentTime.getUTCHours().toString();
		hours = hours.padStart(2, padZero); 
		
		let minutes = tsFormat.isLocalTz ? currentTime.getMinutes().toString() : currentTime.getUTCMinutes().toString();
		minutes = minutes.padStart(2, padZero);
		
		let seconds = tsFormat.isLocalTz ? currentTime.getSeconds().toString() : currentTime.getUTCSeconds().toString();
		seconds = seconds.padStart(2, padZero);
		
		let ms = tsFormat.isLocalTz ? currentTime.getMilliseconds().toString() : currentTime.getUTCMilliseconds().toString();
		ms = ms.padStart(3, padZero);

		if (tsFormat.nYr === 0) yr = ""; // omit year
		else if (tsFormat.nYr < 4) yr = yr.substring(4 - tsFormat.nYr) + "-";
		else yr = yr + "-"; // 4 digit
		
		ms = tsFormat.isShowMs ? ":" + ms : "";
		
		let tz = tsFormat.isLocalTz ? "" : "z";
		
		return (yr + month + "-" + dayOfMonth + "T" + hours + ":" + minutes + ":" + seconds + ms + tz); 
	}
	
	getActiveProfile() {
		return profiles.getActiveProfile();
	}

	setIsEpoch(b) {
		this.timeStampFormat.isEpoch = b;
	}
	
	getIsEpoch() {
		return this.timeStampFormat.isEpoch;
	}
	
	setIsLocalTz(b) {
		this.timeStampFormat.isLocalTz = b;
	}
	
	getIsLocalTz() {
		return this.timeStampFormat.isLocalTz;
	}

	setYearDigits(n) {
		if (n >= 0 && n <= 4) {
			this.timeStampFormat.nYr = n;
		}
	}
	
	getYearDigits() {
		return this.timeStampFormat.nYr;
	}
	
	setIsShowMs(b) {
		this.timeStampFormat.ms = b;
	}
	
	getIsShowMs() {
		return this.timeStampFormat.ms;
	}	
	
	setIsConsoleTs(b) {
		this.isConsoleTs = b;
	}
	
	getIsConsoleTs() {
		return this.isConsoleTs;
	}
	
	setSepCharFile(charStr) {
		this.sepCharFile = charStr;
	}
	
	getSepCharFile() {
		return this.sepCharFile;
	}	
	setSepCharConsole(charStr) {
		this.sepCharConsole = charStr;
	}
	
	getSepCharConsole() {
		return this.sepCharConsole;
	}
	
	setIsColor(b) {
		this.isColor = b;
	}
	
	getIsColor() {
		return this.isColor;
	}
	
	setDepthNum(dn) {
		if (dn === null || typeof dn === "number") {
			this.depthNum = dn;
		}
	}
	
	getDepthNum() {
		return this.depthNum;
	}
	
	

	setLogLevel(logLevelStr) {
		let logLevelTmp;
		logLevelStr = logLevelStr.trim().toUpperCase();
		logLevelTmp = this.logLevels.findIndex(level => level === logLevelStr);
		if (logLevelTmp >= 0 && logLevelTmp < this.logLevels.length) {
			this.logLevel = logLevelTmp;
		} else {
			return;
		}
		if (this.logLevel > 0 && this.isFile) {
			this.ensureWriteStream();
		}		
	}
	
	getLogLevel() {
		return this.logLevels[this.logLevel];
	}
	
	setIsConsole(b) {
		this.isConsole = b;
	}
	
	getIsConsole() {
		return this.isConsole;
	}

	setIsFile(b) {
		this.isFile = b;
		if (this.isFile && this.logLevel > 0) {
			this.ensureWriteStream();
		}
	}
	
	getIsFile() {
		return this.isFile;
	}
	
	getFn() {
		return this.fn || this.getActiveProfile().fn;
	}
	
	// Make sure the stream registry has a stream for us
	ensureWriteStream() {
		if (this.wsSource === this.wsSources.custom) {
			try {
				profiles.newCustomWriteStream(this.getFn());
			} catch(err) {
				throw("Was unable to find or create a valid custom logfile");
			}
		}
		else if (this.wsSource === this.wsSources.global) {
			// use the default filename and common writeStream
			this.fn = this.activeProfile.fn;
			try {
				profiles.newProfileWriteStream(this.getFn());
			} catch(err) {
				throw("Was unable to find or create a valid logfile for profile.", err);
			}								
		}
		this.ucFn = this.getFn() ? this.getFn().replace(/\s+/g, '').toUpperCase() : null;		
	}		
	
	formatArgs(args, isColor) {
		let result = args.reduce((msg, arg) => {
			if (Array.isArray(arg)) return msg + inspect(arg, false, this.depthNum, isColor);
			switch(typeof arg) {
				
				case "string": return msg+arg;
				
				case "object":
				return msg + "\n" + inspect(arg, false, this.depthNum, isColor);			
				
				default: return msg + String(arg);
			}
		},"");
		return result;
	}
	
	write2log(logLevelNum, logLevelStr, isColor, msg) {
		let bufferOk = true; // will be set later by "backpressure" indicator from writeStream.write
		let t;
		if (!isColor) {
			if (Array.isArray(msg)) t = this.formatArgs(msg, false);
			else t = msg;			
		}
		let timestamp = GwLogger.getTimeStamp(this.timeStampFormat);
		if (this.isConsole) {
			if (isColor) {
				if (Array.isArray(msg)) t = this.formatArgs(msg, true);
				else t = msg;
			}
			let mn = this.moduleName 
				? logLevelStr + this.sepCharConsole + this.moduleName + ":" + this.sepCharConsole 
				: logLevelStr + ":" + this.sepCharConsole;	
			let ts = this.isConsoleTs 
				? timestamp
				: "";
			if (logLevelNum > 4) { // Not a serious problem, no color
				console.log(ts + this.sepCharConsole + mn + t); // use OS's default color for console messages
			} 
			else if (logLevelNum <= 2) { // Fatal or Error, use red
				console.log("\x1b[31m%s\x1b[0m", ts + this.sepCharConsole + mn + t); // red text
			}
			else if (logLevelNum === 3) { // Warning, use yellow
				console.log("\x1b[33m%s\x1b[0m", ts + this.sepCharConsole + mn + t); // yellow text
			}
			else if (logLevelNum === 4) { // Notice, use green
				console.log("\x1b[32m%s\x1b[0m", ts + this.sepCharConsole + mn + t); // green text
			}			
		}		
		if (this.isFile) {
			if (isColor) { // if was false, this can use same formatting (t) as console
				if (Array.isArray(msg)) t = this.formatArgs(msg, false); // no color for logfile
				else t = msg;
			}
			//else t = msg;
			let txt = this.moduleName 
				? timestamp + this.sepCharFile + logLevelStr+" " + this.moduleName + ": " + t 
				: timestamp + this.sepCharFile + logLevelStr+": " + t;
			try {
				bufferOk = writePool.write(this.ucFn, txt+"\n");
			} catch(err) {
				console.error("ERROR in GwLogger: ucFn=",this.ucFn,err);
				throw err;
			}
		}
		return bufferOk;
	}
	
	// Note that color formatting for body of message is set 'false' for messages with own color scheme.
	fatal(...args) {
		if (this.logLevel>0) {
			return this.write2log(1, this.logLevels[1], false, args);
		}
		return;
	}
	
	error(...args) {
		if (this.logLevel>1) {
			return this.write2log(2, this.logLevels[2], false, args);
		}
		return;
	}
	
	warn(...args) {
		if (this.logLevel>2) {
			return this.write2log(3, this.logLevels[3], false, args);
		}
		return;
	}
	
	notice(...args) {
		if (this.logLevel>3) {
			return this.write2log(4, this.logLevels[4], false, args);
		}
		return;
	}
	
	info(...args) {
		if (this.logLevel>4) {
			return this.write2log(5, this.logLevels[5], this.isColor, args);
		}
		return;
	}
	
	dev(...args) {
		if (this.logLevel>5) {
			return this.write2log(6, this.logLevels[6], this.isColor, args);
		}
		return;
	}
	
	debug(...args) {
		if (this.logLevel>6) {
			return this.write2log(7, this.logLevels[7], this.isColor, args);
		}
		return;
	}
	
	trace(...args) {
		if (this.logLevel>7) {
			return this.write2log(8, this.logLevels[8], this.isColor, args);
		}
		return;
	}
	
} // end of class GwLogger

/*
export { GwLogger };
*/

exports.GwLogger = GwLogger;
