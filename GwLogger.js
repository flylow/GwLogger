"use strict";
/** 
 * @overview  
 * GwLogger is a simple-to-use Node.js logger that streams to file and/or console.  
 * There are no dev dependencies for GwLogger, but if you are modifying
 * GwLogger's code and use Eslint please use the included eslintrc.json profile.
 * The documented public API is 100% contained in GwLogger.js. 
 *
 * For more information, see README.MD and CHANGELOG.MD at the
 *  <a href="https://github.com/flylow/GwLogger">github repository.</a>
 *  Test info is in the test directory's DescriptionsOfTests.txt.
 *
 * @version 1.5.3
 * @license MIT.
 * @author G. Wilson, 11/2020
 */
 
// A directive for exceptions to ESLint no-init rule 
/*global console, require, exports */ 

const writePool = require("./WritePool.js");
const { ProfileClass } = require("./Profiles"); 
// TODO REMOVEconst getTimeStamp = require("./timestamps.js").getTimeStamp;
const timestamps = new (require("./Timestamps.js").Timestamps);
const getTimeStamp = timestamps.getTimeStamp;
const inspect = require("util").inspect; 
const existsSync = require("fs").existsSync;
const EventEmitter = require("events");

const version = "1.5.3";

/**
 * @desc Creates the logger instance.
 * @class 
 * @param {(string|object)} param1 - Optional, either a loglevel string 
 * ("OFF", "FATAL", "ERROR", "NOTICE", "INFO", "DEV", "DEBUG", "TRACE", 
 * or "ALL") or an object that points to a JSON file containing a profile. 
 * @param {string} param1.profileFn - If param1 is an object, this attribute 
 * is required. A relative or absolute path pointing to a JSON profile.
 * @param {boolean} isConsole - Optional, set to true for output to stdout.
 * @param {boolean} isFile - Optional, set to true for output to a logfile.
 * @param {string} fn - Optional, A relative or absolute path to the logfile.
 */
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
				let errorList = [msgs.errNoJson01(param1.profileFn)];			
				throw {location: "GwLogger.constructor"
				, gwErrCode: 221
				, message: msgs.errConfig
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

		// GwLogger listener: a serious issue has required shutting off logging to file.
		this.eventEmitter.on("GwLoggerSystemMsgx42021", (gwMsgCode) => {
			if (gwMsgCode > 3220 && gwMsgCode < 3225) {
				this.setIsFile(false); // turn-off logging to file for this logger
			}
		});
		// GwLogger listener: a serious issue required shutting off all rolling.
		this.eventEmitter.on("GwLoggerSystemMsgx42021", (gwMsgCode) => {
			if (gwMsgCode === 3242) {
				this.setRollBySize(false);
				this.setRollAtStartup(false);
				this.setRollAsArchive(false);
			}
		});		
	} // end of constructor 

	
	/** Test Instrumentation 
	*	@private 
	*	@returns {object} A profile instance.
	*/
	getProfilesInstance() {
		return this.profile;
	}
	
	// EventEmitter facade
	/** @param {string} eventType - One of: error, warn, or buffer.
	*	@param {function} listener - A handler for the event.
	*/
	on(eventType, listener) {
		this.eventEmitter.addListener(eventType, listener);
	}
	
	/** @param {string} eventType - One of: error, warn, or buffer. 
	*	@param {function} listener - A handler for the event.
	*/	
	once(eventType, listener) {
		this.eventEmitter.once(eventType, listener);
	}
	
	/** @param {string} eventType - One of: error, warn, or buffer. 
	*	@param {function} listener - A handler for the event.
	*/	
	off(eventType, listener) {
		this.eventEmitter.removeListener(eventType, listener);
	}
	
	/** @param {string} eventType - One of: error, warn, or buffer. */
	listeners(eventType) {
		return this.eventEmitter.listeners(eventType);
	}
	
	/** @param {string} eventType - One of: error, warn, or buffer. */
	listenerCount(eventType) {
		return this.eventEmitter.listenerCount(eventType);
	}
	
	/**
	* @param {string} mn - Module name or short descriptor.
	*/
	setModuleName(mn) {		
		this.moduleName = mn.trim();
	}	
	/** @returns {string}*/
	getModuleName() {
		return this.moduleName;
	}
	
	/** @returns {string} Current version of GwLogger module. */
	getVersion() {
		return GwLogger.getVersion();
	}
	
	/** @returns {string} Current version of GwLogger module. */
	static getVersion() { 
		return version;
	}
	
	/** @private
	 * @returns {object} Current profile settings. 
	*/
	getActiveProfile() {
		return this.profile.getActiveProfile();
	}

	/** @param {boolean} b - true to use millisecond timestamps. */
	setIsEpoch(b) {
		this.timeStampFormat.isEpoch = b;
	}	
	/** @returns {boolean} */
	getIsEpoch() {
		return this.timeStampFormat.isEpoch;
	}
	
	/** @param {boolean} b - true to use local timezone, false sets UTC. */ 
	setIsLocalTz(b) {
		this.timeStampFormat.isLocalTz = b;
	}
	/** @returns {boolean} */
	getIsLocalTz() {
		return this.timeStampFormat.isLocalTz;
	}

	/** @param {integer} n - how many digits to use logging the year, must be in range 0 to 4. */
	setYearDigits(n) {
		if (n >= 0 && n <= 4) {
			this.timeStampFormat.nYr = n;
		}
	}
	/** @returns {integer} */
	getYearDigits() {
		return this.timeStampFormat.nYr;
	}
	
	/** @param {boolean} b - true to include MS in timestamp. */
	setIsShowMs(b) {
		this.timeStampFormat.isShowMs = b;
	}
	/** @returns {boolean} */	
	getIsShowMs() {
		return this.timeStampFormat.isShowMs;
	}	
	
	/** @param {boolean} b - true to add timestamps to console/stdout logging. */
	setIsConsoleTs(b) {
		this.isConsoleTs = b;
	}	
	/** @returns {boolean} */
	getIsConsoleTs() {
		return this.isConsoleTs;
	}
	
	/** @param {string} charStr - String separating parts of logfile statements. */
	setSepCharFile(charStr) {
		this.sepCharFile = charStr;
	}
	/** @returns {string} */
	getSepCharFile() {
		return this.sepCharFile;
	}

	/** @param {string} charStr - String separating parts of console statements. */
	setSepCharConsole(charStr) {
		this.sepCharConsole = charStr;
	}	
	/** @returns {string} */
	getSepCharConsole() {
		return this.sepCharConsole;
	}
	
	/** @param {boolean} b - true to log with color to console. */
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
	/** @returns {string} */	
	getIsColor() {
		return this.isColor;
	}
	
	/** @param {integer} dn - depth level for logging object contents. */
	setDepthNum(dn) {
		if (dn === null || typeof dn === "number") {
			this.depthNum = dn;
		}
	}
	/** @returns {integer} */
	getDepthNum() {
		return this.depthNum;
	}	

	/** @param {string} llStr - A log level setting ("OFF", "ERROR", etc). */
	setLogLevel(llStr) { // sets both internal string and numeric values for loglevel
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
	/** @returns {string} */
	getLogLevel() {
		return this.profile.getLogLevel();
	}
	
	/** @param {boolean} b - true to log to stdout/console. */
	setIsConsole(b) {
		this.isConsole = b;
		this.profile.setIsConsole(b);
	}	
	/** @returns {boolean} */
	getIsConsole() {
		return this.profile.getIsConsole();
	}

	/** @param {boolean} b - true to log to logfile. */
	setIsFile(b) {
		this.isFile = b;
		this.profile.setIsFile(b);
		if (b && this.logLevel > 0) {
			this.ensureWriteStream();
		}
	}	
	/** @returns {boolean} */
	getIsFile() {
		return this.profile.getIsFile();
	}
	
	/** @returns {string} */
	getFn() {
		return this.profile.getFn();
	}

	/** @param {boolean} b - true to compress logfiles to archive directory. */
	setIsRollAsArchive(b) {
		if (typeof b !== "boolean") {
			return null;
		}	
		return this.profile.setIsRollAsArchive(b);
	}
	/** @returns {boolean} */	
	getIsRollAsArchive() {
		return this.profile.getIsRollAsArchive();
	}
	
	/** @param {boolean} b - true to roll the logfile on startup. */
	setIsRollAtStartup(b) {
		if (typeof b !== "boolean") {
			return null;
		}	
		return this.profile.setIsRollAtStartup(b);
	}
	/** @returns {boolean} */
	getIsRollAtStartup() {
		return this.profile.getIsRollAtStartup();
	}
	
	/** @param {boolean} b - true to roll logfiles at a certain size. */
	setIsRollBySize(b) {
		if (typeof b !== "boolean") {
			return null;
		}	
		return this.profile.setIsRollBySize(b);
	}
	/** @returns {boolean} */
	getIsRollBySize() {
		return this.profile.getIsRollBySize();
	}
	
	/**
	* @desc Test instrumentation. Can be turned off by WritePool on an error, 
	* so may differ from profile!
	* End user would see an event generated, so doesn't need this in API.
	* @private 
	* @returns {boolean} 
	*/
	getIsRollBySizeCurrent() { 
		return this.profile.getIsRollBySizeCurrent();
	}
	
	/** @param {integer} kb - approx max of each logfile*/
	setMaxLogSizeKb(kb) { 
		return this.profile.setMaxLogSizeKb(kb);
	}
	/** @returns {integer} */
	getMaxLogSizeKb() {
		return this.profile.getMaxLogSizeKb();
	}

	/** 
	 * @desc Set maximum number of rolled-logs to save before either deleting 
	 * them or rolling them to an archive.	
	@param {integer} n - how many logfiles to keep. 
	@returns {integer} Current setting after change or null if invalid.
	*/
	setMaxNumRollingLogs(n) {
		return this.profile.setMaxNumRollingLogs(n);
	}
	/** @returns {integer} */	
	getMaxNumRollingLogs() {
		return this.profile.getMaxNumRollingLogs();
	}

	/** param {string} p - path to store old logfiles. */
	setRollingLogPath(p) { 
		return this.profile.setRollingLogPath(p);
	}
	/** @returns {string} */	
	getRollingLogPath() {
		return this.profile.getRollingLogPath();
	}

	/** param {sting} p - the path to store compressed old logfiles. */
	setArchiveLogPath(p) {
		return this.profile.setArchiveLogPath(p);
	}
	/** @returns {string} */	
	getArchiveLogPath() {
		return this.profile.getArchiveLogPath();
	}

	/** @private
		@returns {number} */
	getWritableLengthKb() {  // Size in KB of this logfile's write buffer.
		return writePool.getWritableLengthKb(this.ucFn);
	}
	
	/** @private
		@returns {boolean} */
	getIsQueuing() {
		return writePool.getIsQueuing(this.ucFn);
	}
	
	/** @private
		@returns {number} */
	getLocalQueueLength() {
		return writePool.getLocalQueueLength(this.ucFn);
	}
	
	/** @private
		@returns {boolean} */
	getIsRolling() {
		return writePool.getIsRolling(this.ucFn);
	}
	
	/** @private 
		@returns {object} Some internal state info, for debugging */
	getStateRecord() {
		return this.stateRecord;
	}
		
	/**
	* @desc Make sure the stream registry has a stream for us now.
	* @private 
	*/
	ensureWriteStream() {
		this.stateRecord.ensureWriteStreamTime = (new Date()).toISOString();
		if (this.wsSource === this.wsSources.custom) {
			this.profile.verifyCreateWriteStream(this.getFn());
		}
		else if (this.wsSource === this.wsSources.global) {
			// use the default filename and common writeStream
			this.fn = this.profile.getFn();
			this.profile.verifyCreateWriteStream(this.getFn());								
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

	/** @private 
	* 	@param {(array|string)} args 
	* 	@param {boolean} isColor 
	* 	@returns {string} 
	*/	
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
	
	/** @private 
	* 	@param {integer} logLevelNum - numerical value for loglevel. 
	* 	@param {string} logLevelStr - string representation for loglevel.
	* 	@param {boolean} isColor - true if logging in color to console.
	* 	@param {(string|array)} msg - text or array of text/objects to log. 
	* 	@returns {boolean} false if buffer is over its high water mark. 
	*/
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
			if (isColor || !this.isConsole) { // if isColor, use different formatting than console
				if (Array.isArray(msg)) {
						t = this.formatArgs(msg, false); // set isColor to false here
				}
				else {
					t = msg;
				}
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


const msgs = {
	errConfig: "ERROR: Configuration error during GwLogger startup. See errorList for details.",	
	errNoJson01: (s1) =>  {return `ERROR: JSON profile ${s1} not found`;},
	errWrite03: (s1) =>  {return `ERROR: Unknown error while writing to logfile, fn is: ${s1}\n`;}
};	

let red = "\x1b[31m%s\x1b[0m";
let yellow = "\x1b[33m%s\x1b[0m";
let green = "\x1b[32m%s\x1b[0m";


exports.GwLogger = GwLogger;
