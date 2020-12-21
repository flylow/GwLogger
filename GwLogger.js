"use strict";
/** 
 * GwLogger : A simple-to-use Node.js logger that streams to file and/or console. 
 * There are no dev dependencies for GwLogger, but if you are modifying
 * GwLogger and use Eslint please use the included eslintrc.json profile.
 *
 * For more information, see README.MD and CHANGELOG.MD at 
 * https://github.com/flylow/GwLogger Test info is in the test 
 * directory's file: DescriptionsOfTests.txt
 *
 * MIT license.
 * --G. Wilson, 11/2020
 */
 
// A directive for exceptions to ESLint no-init rule 
/*global console, require, exports */ 

const writePool = require("./WritePool.js");
const { ProfileClass } = require("./Profiles"); 
const getTimeStamp = require("./timestamps.js").getTimeStamp;
const inspect = require("util").inspect; 
const existsSync = require("fs").existsSync;
const EventEmitter = require("events");

const version = "1.5.0";

class GwLogger {
	constructor(param1, isConsole, isFile, fn) {
		this.eventEmitter = new EventEmitter();
		// Register logger and get a session-unique logger ID
		this.loggerId = writePool.getLoggerId(this.eventEmitter);
		this.stateRecord = {startTime: (new Date()).toISOString(), errors: []};
		this.profile = null;
		this.logLevelStr = undefined;
		if (typeof param1 === "object" && param1.profileFn) {
			if (!existsSync(param1.profileFn)) { // Does profile exist?	
				let errorList = [msg.errNoJson01(param1.profileFn)];			
				throw {location: "GwLogger.constructor"
				, gwErrCode: 221
				, message: msg.errConfig
				, errorList: errorList};				
			} else {
				isConsole = undefined;
				isFile = undefined;
				fn = undefined;
				this.profile = new ProfileClass(param1.profileFn // profile did exist!
					, this.loggerId, this.eventEmitter);
			}
		} else {
			this.logLevelStr = param1;
			this.profile = new ProfileClass(null
					, this.loggerId, this.eventEmitter, this.logLevelStr, isConsole, isFile, fn);
		}
		// setup env vars, json, or built-ins as defaults
		this.activeProfile = this.profile.getActiveProfile();
		this.logLevels = this.profile.getLogLevels();
		this.wsSources = {global: "global", custom: "custom"};

		this.logLevelStr = this.activeProfile.logLevelStr;
		this.logLevel = this.logLevels
			.findIndex(level => level === this.logLevelStr);
			
		this.moduleName = ""; // short name/description of source file
		this.timeStampFormat = {};
		this.timeStampFormat.isEpoch = this.activeProfile.isEpoch;// TS in MS
		this.timeStampFormat.isLocalTz = this.activeProfile.isLocalTz;
		this.timeStampFormat.isShowMs = this.activeProfile.isShowMs; // log MS
		this.timeStampFormat.nYr = this.activeProfile.nYr; // 0-4 yr digits
		this.timeStampFormat.sephhmmss = ":"; // separator for time
		this.sepCharFile = " "; // separator between parts of logfile messages.
		this.sepCharConsole = " "; // separator between parts of console msgs.
		this.depthNum = 2;
		this.isColor = this.activeProfile.isColor;
		this.setIsColor(this.isColor);
		this.isConsoleTs = this.activeProfile.isConsoleTs;
		
		this.isConsole = this.activeProfile.isConsole;
		this.isFile = this.activeProfile.isFile;
		this.fn = this.activeProfile.fn;
			
		this.ucFn = (this.fn) 
			? writePool.getUcFn(this.fn) 
			: null;	
		this.wsSource = (this.fn) 
			? this.wsSources.custom 
			: this.wsSources.global;
		this.profile.setUcFn(this.ucFn);

		this.stateRecord.wsSource = this.wsSource;
		this.stateRecord.initialActiveProfile = this.activeProfile;
		
		if (fn && this.logLevel > 0 && this.isFile) {
			this.ensureWriteStream();
		}

		// GwLogger listener: a serious issue required shutting off logging.
		this.eventEmitter.on("GwLoggerSystemMsgx42021", (gwMsgCode) => {
			if (gwMsgCode > 3220 && gwMsgCode < 3225) {
				this.setIsFile(false); // turn-off logging to file for this logger
			}
		});
	} // end of constructor.

	
	// Test Instrumentation
	getProfilesInstance() {
		return this.profile;
	}
	
	// EventEmitter facade
	on(eventType, listener) {
		this.eventEmitter.addListener(eventType, listener);
	}
	once(eventType, listener) {
		this.eventEmitter.once(eventType, listener);
	}
	off(eventType, listener) {
		this.eventEmitter.removeListener(eventType, listener);
	}
	listeners(eventType) {
		return this.eventEmitter.listeners(eventType);
	}
	listenerCount(eventType) {
		return this.eventEmitter.listenerCount(eventType);
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
	
	getActiveProfile() {
		return this.profile.getActiveProfile();
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
		this.timeStampFormat.isShowMs = b;
	}	
	getIsShowMs() {
		return this.timeStampFormat.isShowMs;
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
		if (b) {
			red = "\x1b[31m%s\x1b[0m";
			yellow = "\x1b[33m%s\x1b[0m";
			green = "\x1b[32m%s\x1b[0m";
		} else {
			red = "";
			yellow = "";
			green = "";
		}
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

	setLogLevel(llStr) { // sets string and numeric
		let logLevelTmp, logLevelStr;
		if (this.profile.isValidStr(llStr)) {
			logLevelStr = llStr.trim().toUpperCase();
		} else {
			return;
		}
		logLevelTmp = this.logLevels.findIndex(level => level === logLevelStr);
		if (logLevelTmp >= 0 && logLevelTmp < this.logLevels.length) {
			this.logLevel = logLevelTmp;
			this.profile.setLogLevel(logLevelStr);
			this.logLevelStr = logLevelStr;
		} else {
			return;
		}
		if (this.logLevel > 0 && this.isFile) {
			this.ensureWriteStream();
		}		
	}	
	getLogLevel() {  // returns a string
		return this.profile.getLogLevel();
	}
	
	setIsConsole(b) {
		this.isConsole = b;
		this.profile.setIsConsole(b);
	}	
	getIsConsole() {
		return this.profile.getIsConsole();
	}

	setIsFile(b) {
		this.isFile = b;
		this.profile.setIsFile(b);
		if (b && this.logLevel > 0) {
			this.ensureWriteStream();
		}
	}	
	getIsFile() {
		return this.profile.getIsFile();
	}
	
	getFn() {
		return this.profile.getFn();
	}

	setIsRollAsArchive(b) {
		if (typeof b !== "boolean") {
			return null;
		}	
		return this.profile.setIsRollAsArchive(b);
	}	
	getIsRollAsArchive() {
		return this.profile.getIsRollAsArchive();
	}
	
	setIsRollAtStartup(b) {
		if (typeof b !== "boolean") {
			return null;
		}	
		return this.profile.setIsRollAtStartup(b);
	}	
	getIsRollAtStartup() {
		return this.profile.getIsRollAtStartup();
	}
	
	setIsRollBySize(b) {
		if (typeof b !== "boolean") {
			return null;
		}	
		return this.profile.setIsRollBySize(b);
	}
	getIsRollBySize() {
		return this.profile.getIsRollBySize();
	}
	
	//can be turned off by WritePool on an error, so may differ from profile!
	getIsRollBySizeCurrent() { 
		return this.profile.getIsRollBySizeCurrent();
	}
	
	setMaxLogSizeKb(kb) { // approx max of each logfile
		return this.profile.setMaxLogSizeKb(kb);
	}
	getMaxLogSizeKb() {
		return this.profile.getMaxLogSizeKb();
	}

	setMaxNumRollingLogs(n) { // how many logfiles to keep
		return this.profile.setMaxNumRollingLogs(n);
	}	
	getMaxNumRollingLogs() {
		return this.profile.getMaxNumRollingLogs();
	}

	setRollingLogPath(p) { // the path to store old logfiles
		return this.profile.setRollingLogPath(p);
	}	
	getRollingLogPath() {
		return this.profile.getRollingLogPath();
	}

	setArchiveLogPath(p) { // the path to store compressed old logfiles
		return this.profile.setArchiveLogPath(p);
	}	
	getArchiveLogPath() {
		return this.profile.getArchiveLogPath();
	}

	getWritableLengthKb() {  // Size in KB of this logfile's write buffer.
		return writePool.getWritableLengthKb(this.ucFn);
	}
	
	getIsQueuing() {
		return writePool.getIsQueuing(this.ucFn);
	}
	
	getLocalQueueLength() {
		return writePool.getLocalQueueLength(this.ucFn);
	}
	
	getIsRolling() {
		return writePool.getIsRolling(this.ucFn);
	}
	
	getStateRecord() {
		// For internal state
		return this.stateRecord;
	}
	
	// Make sure the stream registry has a stream for us now
	ensureWriteStream() {
		this.stateRecord.ensureWriteStreamTime = (new Date()).toISOString();
		if (this.wsSource === this.wsSources.custom) {
			this.profile.newCustomWriteStream(this.getFn());
		}
		else if (this.wsSource === this.wsSources.global) {
			// use the default filename and common writeStream
			this.fn = this.profile.getFn();
			this.profile.newProfileWriteStream(this.getFn());								
		}
		this.ucFn = this.getFn() 
			? writePool.getUcFn(this.getFn())
			: null;
		this.stateRecord.Ws_fn1 = this.getFn();
		let ws = writePool.getWsStream(this.ucFn);
		this.stateRecord.IsWs = (ws) 
			? true 
			: false;
		this.stateRecord.WsTime = (new Date()).toISOString();
		this.stateRecord.Ws_fn2 = this.getFn();
	}		
	
	formatArgs(args, isColor) {
		let result = args.reduce((msg, arg) => {
			if (Array.isArray(arg)) {
				return msg + inspect(arg, false, this.depthNum, isColor);
			}
			switch(typeof arg) {				
				case "string": return msg+arg;				
				case "object": return msg + "\n" 
					+ inspect(arg, false, this.depthNum, isColor);
				default: return msg + String(arg);
			}
		},"");
		return result;
	}
	
	write2log(logLevelNum, logLevelStr, isColor, msg) {
		// bufferOk is similar to (usually the same) as stream's backpressure.
		let bufferOk = true; 
		let t;
		let timestamp = getTimeStamp(this.timeStampFormat);
		if (this.isConsole) {
			if (Array.isArray(msg)) t = this.formatArgs(msg, isColor);
			else t = msg;			
			let mn = this.moduleName 
				? logLevelStr + this.sepCharConsole + this.moduleName 
					+ ":" + this.sepCharConsole 
				: logLevelStr + ":" + this.sepCharConsole;	
			let ts = this.isConsoleTs 
				? timestamp
				: "";
			if (logLevelNum > 4) { // Not a serious problem, no color
				// use OS's default color for console messages
				console.log(ts + this.sepCharConsole + mn + t); 
			} 
			else if (logLevelNum <= 2) { // Fatal or Error, use red
				console.log(red, ts 
					+ this.sepCharConsole + mn + t); // red text
			}
			else if (logLevelNum === 3) { // Warning, use yellow
				console.log(yellow, ts 
					+ this.sepCharConsole + mn + t); // yellow text
			}
			else if (logLevelNum === 4) { // Notice, use green
				console.log(green, ts + this.sepCharConsole 
					+ mn + t); // green text
			}			
		}		
		if (this.isFile) {
			if (isColor) { // if true use different formatting than console
				if (Array.isArray(msg)) 
						t = this.formatArgs(msg, !isColor);
				else t = msg;
			}
			let txt = this.moduleName 
				? timestamp + this.sepCharFile + logLevelStr + this.sepCharFile 
					+ this.moduleName + ":" + this.sepCharFile + t 
				: timestamp + this.sepCharFile + logLevelStr+":" + this.sepCharFile + t;
			try {
				bufferOk = writePool.write(this.loggerId, this.ucFn, txt+"\n");
			} catch(err) {
					this.eventEmitter.emit("error", 1012, msg.errWrite03(this.fn), err);
			}
		}
		return bufferOk;
	}
	
	// color formatting for body of message is set 'false' for messages with
	// their own color scheme.
	fatal(...args) {
		if (this.logLevel>0) {
			return this.write2log(1, this.logLevels[1], false, args);
		}
		return null;
	}
	
	error(...args) {
		if (this.logLevel>1) {
			return this.write2log(2, this.logLevels[2], false, args);
		}
		return null;
	}
	
	warn(...args) {
		if (this.logLevel>2) {
			return this.write2log(3, this.logLevels[3], false, args);
		}
		return null;
	}
	
	notice(...args) {
		if (this.logLevel>3) {
			return this.write2log(4, this.logLevels[4], false, args);
		}
		return null;
	}
	
	info(...args) {
		if (this.logLevel>4) {
			return this.write2log(5, this.logLevels[5], this.isColor, args);
		}
		return null;
	}
	
	dev(...args) {
		if (this.logLevel>5) {
			return this.write2log(6, this.logLevels[6], this.isColor, args);
		}
		return null;
	}
	
	debug(...args) {
		if (this.logLevel>6) {
			return this.write2log(7, this.logLevels[7], this.isColor, args);
		}
		return null;
	}
	
	trace(...args) {
		if (this.logLevel>7) {
			return this.write2log(8, this.logLevels[8], this.isColor, args);
		}
		return null;
	}
	
} // end of class GwLogger


const msg = {
	errConfig: "ERROR: Configuration error during GwLogger startup. See errorList for details.",	
	errNoJson01: (s1) =>  {return `ERROR: JSON profile ${s1} not found`;},
	errWrite03: (s1) =>  {return `ERROR: Unknown error while writing to logfile, fn is: ${s1}\n`;}
};	

let red = "\x1b[31m%s\x1b[0m";
let yellow = "\x1b[33m%s\x1b[0m";
let green = "\x1b[32m%s\x1b[0m";


exports.GwLogger = GwLogger;
