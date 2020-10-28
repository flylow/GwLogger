"use strict";
/** 
 * GwLogger : A simple-to-use Node.js logger that streams to file and/or console. 
 * There are no dev dependencies for GwLogger, but if you use Eslint please use
 * the included eslintrc.json profile.
 *
 * For more information, see README.MD and CHANGELOG.MD at 
 * https://github.com/flylow/GwLogger Test info is in the test 
 * directory's file: DescriptionsOfTests.txt
 *
 * MIT license.
 * --G. Wilson, 5/2020
 */
 
// A directive for exceptions to ESLint no-init rule 
/*global console, require, exports */ 

const writePool = require("./WritePool.js");
const { ProfileClass } = require("./Profiles"); 
const inspect = require("util").inspect; 
const existsSync = require("fs").existsSync;

const version = "1.2.1";

class GwLogger {
	constructor(param1, isConsole, isFile, fn) {
		this.stateRecord = {startTime: (new Date()).toISOString(), errors: []};
		this.profile = null;
		this.logLevelStr = undefined;
		if (typeof param1 === "object" && param1.profileFn) {
			if (!existsSync(param1.profileFn)) {				
				console.error(yellow, msg.warNoJson01(param1.profileFn));
				param1 = undefined;
				this.logLevelStr = param1;
				this.profile = new ProfileClass();				
			} else {
				isConsole = undefined;
				isFile = undefined;
				fn = undefined;
				this.profile = new ProfileClass(param1.profileFn);
			}
		} else {
			this.logLevelStr = param1;
			this.profile = new ProfileClass();
		}
		// setup env vars, json, or built-ins as defaults
		this.activeProfile = this.profile.getActiveProfile();
		this.logLevels = ["OFF", "FATAL", "ERROR", "WARN", "NOTICE", "INFO"
			, "DEV", "DEBUG", "TRACE", "ALL"];
		this.wsSources = {global: "global", custom: "custom"};
		if (this.profile.isValidStr(this.logLevelStr)) {
			this.logLevelStr = this.logLevelStr.trim().toUpperCase();
		}
		if (!this.profile.isValidStr(this.logLevelStr) 
				|| this.logLevels
					.findIndex(level => level === this.logLevelStr)<0) {
			if (this.logLevelStr) { // typo or such. Post an error message.
				let stack = this.profile.getStackTrace(new Error());
				console.error(yellow, msg.warLL01(this.logLevels.join()
					, this.logLevelStr), stack);
				this.logLevelStr = "NOTICE"; 			
				this.logLevel = 
					this.logLevels.findIndex(level => level === this.logLevelStr);
			} else {
				this.logLevelStr = this.activeProfile.logLevelStr;
				this.logLevel = 
					this.logLevels.findIndex(level => level === this.logLevelStr);
			}
		} else {
			this.logLevel = this.logLevels
				.findIndex(level => level === this.logLevelStr);
		}
		this.moduleName = ""; // short name/description of source file
		this.timeStampFormat = {};
		this.timeStampFormat.isEpoch = this.activeProfile.isEpoch;// TS in MS
		this.timeStampFormat.isLocalTz = this.activeProfile.isLocalTz;
		this.timeStampFormat.isShowMs = this.activeProfile.isShowMs; // log MS
		this.timeStampFormat.nYr = this.activeProfile.nYr; // 0-4 yr digits
		this.sepCharFile = " "; // separator between parts of logfile messages.
		this.sepCharConsole = " "; // separator between parts of console msgs.
		this.depthNum = 2;
		this.isColor = true;
		this.isConsoleTs = this.activeProfile.isConsoleTs;
		
		this.isConsole = isConsole === undefined 
			? this.activeProfile.isConsole 
			: isConsole;
		this.isFile = (isFile === undefined) 
			? this.activeProfile.isFile 
			: isFile;
		this.fn = this.profile.isValidStr(fn) 
			? fn.trim() 
			: null;
		this.ucFn = this.fn 
			? writePool.getUcFn(this.fn) 
			: null;	
		this.wsSource = (this.fn) 
			? this.wsSources.custom 
			: this.wsSources.global;
			
		this.stateRecord.wsSource = this.wsSource;
		this.stateRecord.initialActiveProfile = this.activeProfile;
		
		if (this.wsSource === this.wsSources.global && this.activeProfile.fn
				&& this.logLevel > 0 && this.isFile) {
			this.fn = this.activeProfile.fn;
			this.ensureWriteStream();
		}
		else if (this.wsSource === this.wsSources.custom 
				&& this.fn 
				&& this.logLevel > 0 
				&& this.isFile) {
			this.ensureWriteStream();
		} 		
	}
	
	// Test Instrumentation
	getProfilesInstance() {
		return this.profile;
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
		if (tsFormat.isEpoch) return Date.now(); //UNIX Epoch
		
		let currentTime = new Date();
		if (tsFormat.year === 4 && tsFormat.isShowMs) {
			//2020-07-10T20:56:33.291Z (24 chars)
			return currentTime.toISOString();
		}
		
		const padZero = "0";	
		let yr = tsFormat.isLocalTz 
			? (currentTime.getFullYear()).toString() 
			: (currentTime.getUTCFullYear()).toString();
		
		let month = tsFormat.isLocalTz 
			? (currentTime.getMonth() + 1).toString() 
			: (currentTime.getUTCMonth() + 1).toString();
		month = month.padStart(2, padZero);

		let dayOfMonth = tsFormat.isLocalTz 
			? currentTime.getDate().toString() 
			: currentTime.getUTCDate().toString();
		dayOfMonth = dayOfMonth.toString().padStart(2, padZero);

		let hours = tsFormat.isLocalTz 
			? currentTime.getHours().toString() 
			: currentTime.getUTCHours().toString();
		hours = hours.padStart(2, padZero); 
		
		let minutes = tsFormat.isLocalTz 
			? currentTime.getMinutes().toString() 
			: currentTime.getUTCMinutes().toString();
		minutes = minutes.padStart(2, padZero);
		
		let seconds = tsFormat.isLocalTz 
			? currentTime.getSeconds().toString() 
			: currentTime.getUTCSeconds().toString();
		seconds = seconds.padStart(2, padZero);
		
		let ms = tsFormat.isLocalTz 
			? currentTime.getMilliseconds().toString() 
			: currentTime.getUTCMilliseconds().toString();
		ms = ms.padStart(3, padZero);

		if (tsFormat.nYr === 0) yr = ""; // omit year
			else if (tsFormat.nYr < 4) yr = yr.substring(4 - tsFormat.nYr) + "-";
			else yr = yr + "-"; // 4 digit
		
		ms = tsFormat.isShowMs 
			? ":" + ms 
			: "";
		
		let tz = tsFormat.isLocalTz 
			? "" 
			: "z";
		
		return (yr + month + "-" + dayOfMonth + "T" + hours 
			+ ":" + minutes + ":" + seconds + ms + tz); 
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

	setIsRollAtStartup(b) {
		return this.profile.setIsRollAtStartup(b);
	}	
	getIsRollAtStartup() {
		return this.profile.getIsRollAtStartup();
	}
		
	// roll by size settings
	setIsRollBySize(b) {
		return this.profile.setIsRollBySize(b);
	}
	getIsRollBySize() {
		return this.profile.getIsRollBySize();
	}
	//can be set internally by WritePool on an error and differ from profile
	getIsRollBySizeCurrent() { 
		return writePool.getIsRollBySize(this.ucFn);
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

	getWritableLengthKb() {  // Size in KB of this logfile's write buffer.
		return writePool.getWritableLengthKb(this.ucFn);
	}
	
	getIsQueuing() {
		return writePool.getIsQueuing(this.ucFn);
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
			this.fn = this.activeProfile.fn;
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
		// bufferOk is similar to (sometimes same) as node's stream backpressure.
		let bufferOk = true; 
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
				? timestamp + this.sepCharFile + logLevelStr+" " 
					+ this.moduleName + ": " + t 
				: timestamp + this.sepCharFile + logLevelStr+": " + t;
			try {
				bufferOk = writePool.write(this.ucFn, txt+"\n");
			} catch(err) {
				console.error(msg.errWrite01, err);
				if (err && err.errName 
						&& (err.errName === "nofileorstreamfatal" 
							|| err.errName === "cannotwritefatal")) {
					this.isFile = false; // give up logging to file
					console.error(msg.errWrite02); // surface state to user/stderr
					bufferOk = false;
					this.stateRecord.errors.push(err);
					return bufferOk;
				} else {
					console.error(msg.errWrite03(this.fn), err);
					throw err;
				}
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


const msg = {
	errCf01: (s1) =>  {return `ERROR in GwLogger creating initial logfile for: 
${s1}\n`;},
	warNoJson01: (s1) =>  {return `WARNING: JSON profile ${s1} not found, 
continuing with default profile`;},
	warLL01: (s1, s2) =>  {return `WARNING: Log level must be one of: ${s1}
But, found log level of: ${s2}.
>>Log level will now be set to NOTICE and will continue.<<\n`;},
	errWrite01: "Error: GwLogger error writing to logfile:\n",
	errWrite02: "Error: Logging to file has been turned off due to errors.",
	errWrite03: (s1) =>  {return `ERROR in GwLogger: fn is: ${s1}\n`;},
};	

const red = "\x1b[31m%s\x1b[0m";
const yellow = "\x1b[33m%s\x1b[0m";
const green = "\x1b[32m%s\x1b[0m";


exports.GwLogger = GwLogger;
