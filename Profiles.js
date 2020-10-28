"use strict";

/* Profiles.js creates and stores the profile data for a GwLogger.
 * It can gather data from environment variables or JSON files.
 * It contains built-in defaults, overlaying those settings with
 * the other gathered data, and stores the resulting activeProfile.
 *
 * Starting in GwLogger version 1.1.0, each instance of GwLogger has 
 * its own associated instance of Profiles.
 *
*/

// A directive for exceptions to ESLint no-init rule
/*global console, process, require, exports */ 

const readFileSync = require("fs").readFileSync;
const existsSync = require("fs").existsSync;
const path = require("path");
const writePool = require("./WritePool.js");
const version = "1.2.1";

class Profiles {

	constructor(profilePath) {
		this.activeProfile = null;
		this.logLevelDefault = "OFF";
		this.tsFormatDefaults = {
			isEpoch: false, isLocalTz: true, nYr: 0, isShowMs: true
			};
		this.isConsoleTsDefault = false; // console timestamps
		this.isConsoleDefault = false;
		this.isFileDefault = true;
		this.isRollAtStartup = false;
		this.isRollBySize = false;
		this.maxLogSizeKb = 0; 
		this.maxNumRollingLogs = 0;
		this.rollingLogPath = null;
		this.path_separator = (process.platform.startsWith("win")) 
			? "\\" 
			: "/"; // okay here, but not always trustworthy, see checkPath(fn);
		this.path = process.cwd();
		this.fnDefault = this.path + this.path_separator + "gwl_log.log";
		this.fnPath = this.path;
		this.ucFn = null;
		this.profileName = (profilePath) 
			? profilePath 
			: this.path + this.path_separator +  "GwLogger.json";
		this.customStreams = {};
		// Some init code to read profile/set active profile
		this.init = function() {
			let activeProfile = this.getActiveProfile();
			if (!activeProfile) {
				let envJson = this.getEnvProfile(); // Use environment variables?
				if (envJson) {
					this.createActiveProfile(envJson);
				} else try {
					let fileJson = this.getJsonProfile();  // JSON profile?
					this.createActiveProfile(fileJson);
				} catch(err) { // built-in defaults to get started.
					let defJson = this.getDefaultProfile();
					this.createActiveProfile(defJson);
				}
			}
		};	
		this.init();
		
	} // End of constructor
	
	getVersion() {
		return version;
	}
	
	// For verifying a file spec that is entered by user. Returns a path, only if 
	// path was valid and exists already, else null
	checkPath(pathWithFn) {
		let p, endPath;
		// Trial and Error, since can sometimes expect '/' or '\' from Win users
		endPath = pathWithFn.lastIndexOf("\\");
		if (endPath === -1) endPath = pathWithFn.lastIndexOf("/");
		p = pathWithFn.substring(0,endPath + 1);
		p = ( p && existsSync(p)) ? p : null;
		return (p) ? path.resolve(p) : null;
	}
	
	getStackTrace(err) { // Trims stacktrace to better point at perpetrator
		let stack = err.stack;
		stack = stack.split("\n").map(
			function (statement) {
				return statement.trim(); 
		});
		return stack.splice(stack[0] == "Error" 
			? 2 
			: 1);		
	}
	
	isValidStr(str) {
		if (typeof str === "string" && str.length > 0) {
		return true;
		}
		else {
			return false;
		}
	}
		
	str2Bool(str) {
		if (this.isValidStr(str)) {
			str = str.trim().toLowerCase();
			if (str === "true") return true;
			if (str === "false") return false;
		}
		return null; // not a boolean
	}

	isNumber(str) {
		return !isNaN(parseFloat(str)) && isFinite(str);
	}

	// coerce is limited to strings, booleans, and integers 
	coerce(str) {
		let b = this.str2Bool(str);
		if (b !== null) return b; // return the boolean
		return this.isNumber(str)
			? parseInt(str) // watch for nYr or other integer value
			: str.trim(); // return a string
	}

	getDefaultProfile() {
		let defJson = {
				logLevelStr: this.logLevelDefault
				, isFile: this.isFileDefault
				, isConsole: this.isConsoleDefault
				, fn: this.fnDefault
				, isEpoch: this.tsFormatDefaults.isEpoch
				, isLocalTz: this.tsFormatDefaults.isLocalTz
				, nYr: this.tsFormatDefaults.nYr
				, isShowMs: this.tsFormatDefaults.isShowMs
				, isConsoleTs: this.isConsoleTsDefault
				, isRollAtStartup: this.isRollAtStartup
				, isRollBySize: this.isRollBySize
				, maxLogSizeKb: this.maxLogSizeKb
				, maxNumRollingLogs: this.maxNumRollingLogs
				, rollingLogPath: this.rollingLogPath
		};
		return defJson;
	}
	
	getJsonProfile() {
		const defJson = this.getDefaultProfile();
		let fileJson = null;
		if (existsSync(this.profileName)) {
			fileJson = JSON.parse(readFileSync(this.profileName));
		}
		// use json file, fill in empty spots from defaults.
		fileJson = { ...defJson, ...fileJson}; 
		return fileJson;
	}
		
	getEnvProfile() {
		let envJson = this.getDefaultProfile();
		let isEnvProfile = false;
		let ekey, evalue;
		for (let key in envJson) {
			if (Object.hasOwnProperty.call(envJson, key)) {			
				ekey = "GWL_" + key;
				evalue = process.env[ekey];
				if (this.isValidStr(evalue)) {
					envJson[key] = this.coerce(evalue);
					isEnvProfile = true;
				}
			}
		}
		if (isEnvProfile) {
			return envJson;
		} else 
			return null;	
	}	

	getLogLevels() {
		return ["OFF", "FATAL", "ERROR", "WARN", "NOTICE", "INFO", "DEV", "DEBUG"
			, "TRACE", "ALL"];
	}
	
	Str2NumLogLevel(levelStr) {
		let logLevelStr = levelStr.trim().toUpperCase();
		let logLevel = 
			this.getLogLevels().findIndex(level => level === logLevelStr);
		return logLevel;
	}	

	getActiveProfile() {
		if (!this.activeProfile) {
			return null;
		}
		else {
			return this.activeProfile;
		}
	}
	
	newProfileWriteStream(fn) {
		let isError = false;
		try {
			if (!fn || !(this.fnPath = this.checkPath(fn))) {
				isError = true;
				throw "catch/re-throw below";		
			}
			// get or create a stream for this fn
			return writePool.getStream(fn, false, this.getActiveProfile());
		} catch(err) {
			const errTxt = (isError) 
				? msg.errNoLog01(fn) 
				: msg.errNoLog02(fn);
			throw errTxt;			
		}		
	}
	
	newCustomWriteStream(fn) { 
		let isError = false;		
		try {
			if (!fn || !(this.fnPath = this.checkPath(fn))) {
				isError = true;
				throw "catch/re-throw below";		
			}
			return writePool.getStream(fn, false, this.getActiveProfile());			
		} catch(err) {
			const errTxt = (isError) 
				? msg.errNoLog01(fn) 
				: msg.errNoLog03(fn);
			throw errTxt;			
		}		
	}
	
	// test instrumentation
	deleteProfileData() {
		// are you sure? This should only be done during testing.
		this.activeProfile = null;
	}
	
	// test instrumentation
	getProfileData() {
		return this.activeProfile;
	}
	
	// test instrumentation
	setProfileData(p) {
		// are you sure? This should only be done during testing.
		this.activeProfile = p;
	}
		
	storeProfileData(logLevelStr, isFile, isConsole, fn, isEpoch, isLocalTz, nYr
			, isShowMs, isConsoleTs, isRollAtStartup, isRollBySize, maxLogSizeKb
			, maxNumRollingLogs, rollingLogPath) {
		// Will overwrite existing profile data, if any
		this.activeProfile = {fn: fn, logLevelStr: logLevelStr, 
			isFile: isFile, isConsole: isConsole, isEpoch: isEpoch
			, isLocalTz: isLocalTz, nYr: nYr,
			isShowMs: isShowMs, isConsoleTs: isConsoleTs
			, isRollAtStartup: isRollAtStartup, isRollBySize: isRollBySize
			, maxLogSizeKb: maxLogSizeKb, 
			maxNumRollingLogs: maxNumRollingLogs, rollingLogPath: rollingLogPath};
		return;
	}	
	
	// profileCandidate is an object created from env vars, the JSON profile or 
	// from built-in defaults.
	createActiveProfile(profileCandidate) { 
		if (this.activeProfile) { // don't do this twice
			let stack = this.getStackTrace(new Error());
			console.warn(yellow, msg.warRedef01, stack);
			return null; // unable to set previously defined stream.
		}
		let logLevelStr = profileCandidate.logLevelStr;
		if (!this.isValidStr(logLevelStr)) {
			let stack = this.getStackTrace(new Error());			
			console.error(red, msg.errNoLL01(this.getLogLevels().join())
				+ "\n",stack);
			process.exit(1); // All stop
		}
		logLevelStr = logLevelStr.trim().toUpperCase();
		let logLevelTmp = this.Str2NumLogLevel(logLevelStr);
		if (logLevelTmp < 0 || logLevelTmp > (this.getLogLevels().length - 1) ) {
			let stack = this.getStackTrace(new Error());			
			console.error(red, msg.errNoLL02(logLevelStr, this.getLogLevels().join())
			+ "\n",stack);
			process.exit(1); // All stop
		}
		let fn = profileCandidate.fn;
		if (!this.isValidStr(fn)) {
			let stack = this.getStackTrace(new Error());			
			console.error(red + msg.errNoLog04, stack);
			process.exit(1); // All stop			
		}
		fn = fn.trim();
		this.ucFn = writePool.getUcFn(fn);
		let isFile = profileCandidate.isFile;
		if (typeof isFile !== "boolean") {
			let err = new Error();
			console.error(red, msg.errPTF01("isFile", isFile), err.stack);
			process.exit(1); // All stop
		}	
		let isConsole = profileCandidate.isConsole;
		if (typeof isConsole !== "boolean") {
			let err = new Error();
			console.error(red, msg.errPTF01("isConsole", isConsole), err.stack);
			process.exit(1); // All stop
		}
		let isEpoch = profileCandidate.isEpoch;
		if (typeof isEpoch !== "boolean") {
			let err = new Error();
			console.error(red, msg.errPTF01("isEpoch", isEpoch), err.stack);
			process.exit(1); // All stop
		}
		let isLocalTz = profileCandidate.isLocalTz;
		if (typeof isLocalTz !== "boolean") {
			let err = new Error();
			console.error(red, msg.errPTF01("isLocalTz", isLocalTz), err.stack);
			process.exit(1); // All stop
		}
		let nYr = profileCandidate.nYr;
		if (nYr > 4 || nYr < 0) {
			let err = new Error();
			console.error(red, msg.errYr01(nYr), err.stack);
			process.exit(1); // All stop
		}
		let isShowMs = profileCandidate.isShowMs;
		if (typeof isShowMs !== "boolean") {
			let err = new Error();
			console.error(red, msg.errPTF01("isShowMS", isShowMs), err.stack);
			process.exit(1); // All stop
		}
		let isConsoleTs = profileCandidate.isConsoleTs;
		if (typeof isConsoleTs !== "boolean") {
			let err = new Error();
			console.error(red, msg.errPTF01("isConsoleTs", isConsoleTs), err.stack);
			process.exit(1); // All stop
		}
		
		let isRollAtStartup = profileCandidate.isRollAtStartup;
		if (typeof isRollAtStartup !== "boolean") {
			let err = new Error();
			console.error(red, msg.errPTF01("isRollAtStartup", isRollAtStartup), err.stack);
			process.exit(1); // All stop
		}		

		let isRollBySize = profileCandidate.isRollBySize;
		if (typeof isRollBySize !== "boolean") {
			let err = new Error();
			console.error(red, msg.errPTF01("isRollBySize", isRollBySize), err.stack);
			process.exit(1); // All stop
		}
		let maxLogSizeKb = profileCandidate.maxLogSizeKb;
		if (maxLogSizeKb < 0) {
			let err = new Error();
			console.error(red, msg.errLs01(maxLogSizeKb), err.stack);
			process.exit(1); // All stop
		}
		let maxNumRollingLogs = profileCandidate.maxNumRollingLogs;
		if (maxNumRollingLogs > 20 || maxNumRollingLogs < 0) {
			let err = new Error();
			console.error(red, msg.errNl01(maxNumRollingLogs), err.stack);
			process.exit(1); // All stop
		}
		let rollingLogPath;
		rollingLogPath = (profileCandidate.rollingLogPath) 
			? path.resolve(profileCandidate.rollingLogPath) 
			: null;
		if ((isRollAtStartup || isRollBySize || rollingLogPath) 
				&& (!this.isValidStr(rollingLogPath) 
					|| !existsSync(rollingLogPath)) ) { 
			let stack = this.getStackTrace(new Error());			
			console.error(red, msg.errRp01(rollingLogPath),stack);
			process.exit(1); // All stop			
		}
		if (maxLogSizeKb === 0 || maxNumRollingLogs === 0) {
			isRollBySize = false;
		} 		
		
		if (!this.activeProfile) {
			this.storeProfileData(
				logLevelStr, isFile, isConsole, fn, isEpoch, isLocalTz, nYr
				, isShowMs, isConsoleTs, isRollAtStartup, isRollBySize
				, maxLogSizeKb, maxNumRollingLogs, rollingLogPath );
			return;
		}	
	}
	
	// roll at Startup settings
	setIsRollAtStartup(b) { 
		this.activeProfile.isRollAtStartup = b;
	}	
	getIsRollAtStartup() {
		return this.activeProfile.isRollAtStartup;
	}	
	
	// roll by size settings
	setIsRollBySize(b) {
		if (typeof b !== "boolean") {
			return null;
		}
		this.activeProfile.isRollBySize = b;
		writePool.setIsRollBySize(this.ucFn, b);
		return b;
	}
	getIsRollBySize() {
		return this.activeProfile.isRollBySize;
	}	
	getIsRollBySizeCurrent() { //can be set internally by WritePool on an error
		return writePool.getIsRollBySize(this.ucFn);
	}
	
	setMaxLogSizeKb(kb) { // approx max of each logfile
		if (kb < 0) { 
			return null;
		}
		this.activeProfile.maxLogSizeKb = kb;		
		writePool.setMaxLogSizeKb(this.ucFn, kb);
		return kb;
	}
	getMaxLogSizeKb() {
		return this.activeProfile.maxLogSizeKb;
	}

	setMaxNumRollingLogs(n) { // how many logfiles to keep
		if (n > 20 || n < 0) {
			return null;
		}
		this.activeProfile.maxNumRollingLogs = n;
		writePool.setMaxNumRollingLogs(this.ucFn, n);
		return n;
	}	
	getMaxNumRollingLogs() {
		return this.activeProfile.maxNumRollingLogs;
	}

	setRollingLogPath(rollingLogPath) {
		rollingLogPath = rollingLogPath.trim();
		rollingLogPath = path.resolve(rollingLogPath);
		if (!existsSync(rollingLogPath) ) {
			return false; // bad path
		}
		this.activeProfile.rollingLogPath = rollingLogPath;
		writePool.setRollingLogPath(this.ucFn, rollingLogPath);
		return this.activeProfile.rollingLogPath;
	}	
	getRollingLogPath() {
		return this.activeProfile.rollingLogPath;
	}
		

} // end of Profiles class


const msg = {
	errNoLog01: (s1) => {return `ERROR: Could not find directory for this logfile: ${s1}`;},
	errNoLog02: (s1) => {return `Error creating a new profile file stream with file: ${s1}`;},
	errNoLog03: (s1) => {return `Error creating a new custom file stream with file: ${s1}`;},
	warRedef01:	"WARNING: Defaults cannot be redefined.\n",
	errNoLL01: (s1) => {return `ERROR: Profile requires a log level, one of: ${s1}`;},
	errNoLL02: (s1, s2) => {return `ERROR: Profile tried to set unknown log level of: ${s1}. Must be one of: ${s2}`;},
	errNoLog04: "ERROR: Profile requires a logfile name including extensions.\n",
	errPTF01: (s1, s2) => {return `ERROR: Profile ${s1} must be true or false. Found: ${s2}\n`;},
	errYr01: (s1) => {return `ERROR: Profile nYr must be of type Number from 0-4. Found: ${s1}\n`;},
	errLs01: (s1) => {return `ERROR: Profile maxLogSizeKb must be a zero or greater Number. Found: ${s1} \n`;},
	errNl01: (s1) => {return `ERROR: Profile maxNumRollingLogs must be of type Number from 0-20. Found: ${s1}\n`;},	
	errRp01: (s1) => {return `ERROR: Rolling logs require an existing logfile directory, but ${s1} does not exist.\n`;}
};	

const red = "\x1b[31m%s\x1b[0m";
const yellow = "\x1b[33m%s\x1b[0m";


exports.ProfileClass = Profiles;


