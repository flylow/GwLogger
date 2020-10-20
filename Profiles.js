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

/*global console, process, require, exports */ // A directive for exceptions to ESLint no-init rule

const readFileSync = require("fs").readFileSync;
const existsSync = require("fs").existsSync;
const path = require("path");
const writePool = require("./WritePool.js");
const version = "1.2.0";

class Profiles {

	constructor(profilePath) {
		this.activeProfile = null;
		this.logLevelDefault = "OFF";
		this.tsFormatDefaults = {isEpoch: false, isLocalTz: true, nYr: 0, isShowMs: true};
		this.isConsoleTsDefault = false; // console timestamps
		this.isConsoleDefault = false;
		this.isFileDefault = true;
		this.isRollAtStartup = false;
		this.isRollBySize = false;
		this.maxLogSizeKb = 0; 
		this.maxNumRollingLogs = 0;
		this.rollingLogPath = null;
		this.path_separator = (process.platform.startsWith("win")) ? "\\" : "/"; // okay here, but not always trustworthy, see checkPath(fn);
		this.path = process.cwd();
		this.fnDefault = this.path + this.path_separator + "gwl_log.log";
		this.fnPath = this.path;
		this.ucFn = null;
		this.profileName = (profilePath) ? profilePath : this.path + this.path_separator +  "GwLogger.json";
		this.customStreams = {};
		// Some init code to read profile/set active profile
		this.init = function() {
			let activeProfile = this.getActiveProfile();
			if (!activeProfile) {
				let envJson = this.getEnvProfile(); // Hunt for logger settings in the environment variables
				if (envJson) {
					this.createActiveProfile(envJson);
				} else try {
					let fileJson = this.getJsonProfile();  // Nothing in environment variables, try loading a profile file.
					this.createActiveProfile(fileJson);
				} catch(err) { // no profile, so use built-in defaults to get started. TODO, using catch for a normal path!!?
					let defJson = this.getDefaultProfile();
					this.createActiveProfile(defJson);
				}
			}
		};	
		this.init();
		
	} // End of constructor
	
	// For verifying a file spec that is entered by user. Returns a path, only if path was valid and exists already, else null
	checkPath(pathWithFn) {
		let p, endPath;
		// Trial and Error, since can sometimes expect '/' or '\' from user on Windows
		endPath = pathWithFn.lastIndexOf("\\");
		if (endPath === -1) endPath = pathWithFn.lastIndexOf("/");
		p = pathWithFn.substring(0,endPath + 1);
		p = ( p && existsSync(p)) ? p : null;
		return (p) ? path.resolve(p) : null;
	}
	
	getStackTrace(err) { // Trims stacktrace to better point at perpetrator
		let stack = err.stack;
		stack = stack.split("\n").map(function (statement) { return statement.trim(); });
		return stack.splice(stack[0] == "Error" ? 2 : 1);		
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
		if (b !== null) return b; 
		return this.isNumber(str) ? parseInt(str) : str.trim(); // watch for nYr or other integer value
	}

	getDefaultProfile() {
		let defJson = {logLevelStr: this.logLevelDefault, isFile: this.isFileDefault, isConsole: this.isConsoleDefault, fn: this.fnDefault, 
			isEpoch: this.tsFormatDefaults.isEpoch,  isLocalTz: this.tsFormatDefaults.isLocalTz, nYr: this.tsFormatDefaults.nYr, 
			isShowMs: this.tsFormatDefaults.isShowMs, isConsoleTs: this.isConsoleTsDefault, isRollAtStartup: this.isRollAtStartup, isRollBySize: this.isRollBySize, maxLogSizeKb: this.maxLogSizeKb, maxNumRollingLogs: this.maxNumRollingLogs, rollingLogPath: this.rollingLogPath};
		return defJson;
	}
	
	getJsonProfile() {
		const defJson = this.getDefaultProfile();
		let fileJson = null;
		if (existsSync(this.profileName)) {
			fileJson = JSON.parse(readFileSync(this.profileName));
		}
		fileJson = { ...defJson, ...fileJson}; // use json file, fill in empty spots from defaults.
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
		return ["OFF", "FATAL", "ERROR", "WARN", "NOTICE", "INFO", "DEV", "DEBUG", "TRACE", "ALL"];
	}
	
	Str2NumLogLevel(levelStr) {
		let logLevelStr = levelStr.trim().toUpperCase();
		let logLevel = this.getLogLevels().findIndex(level => level === logLevelStr);
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
		let activeProfile = this.getActiveProfile();
		try {
			if (!fn || !(this.fnPath = this.checkPath(fn))) {
				let stack = this.getStackTrace(new Error());			
				console.error("\x1b[31m%s\x1b[0m", "ERROR: Could not find path for logfile: ", fn, "\n",stack);
				throw("Could not find path for logfile.");		
			}
			// get or create a stream for this fn
			return writePool.getStream(fn, false, this.getActiveProfile());
		} catch(err) {
			throw("Unlikely logfile path or other issue while creating a new profile file stream in GwLogger.\n" + err);			
		}		
	}
	
	newCustomWriteStream(fn) {
		try {
			if (!fn || !(this.fnPath = this.checkPath(fn))) {
				let stack = this.getStackTrace(new Error());			
				console.error("\x1b[31m%s\x1b[0m", "ERROR: Could not find path for logfile: ", fn, "\n",stack);
				throw("Could not find path for logfile.");		
			}
			return writePool.getStream(fn, false, this.getActiveProfile());			
		} catch(err) {
			throw("Unlikely logfile path or other issue while creating a new logging file stream in GwLogger.\n" + err);			
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
		
	storeProfileData(logLevelStr, isFile, isConsole, fn, isEpoch, isLocalTz, nYr, isShowMs, isConsoleTs, isRollAtStartup, isRollBySize, maxLogSizeKb, maxNumRollingLogs, rollingLogPath) {
		// Will overwrite existing profile data, if any
		this.activeProfile = {fn: fn, logLevelStr: logLevelStr, 
			isFile: isFile, isConsole: isConsole, isEpoch: isEpoch, isLocalTz: isLocalTz, nYr: nYr,
			isShowMs: isShowMs, isConsoleTs: isConsoleTs, isRollAtStartup: isRollAtStartup, isRollBySize: isRollBySize, maxLogSizeKb: maxLogSizeKb, 
			maxNumRollingLogs: maxNumRollingLogs, rollingLogPath: rollingLogPath};
		return;
	}	
	
	createActiveProfile(profileCandidate) { //profileCandidate is an object created from env vars, the JSON profile or from built-in defaults.
		if (this.activeProfile) { // see if defaults have already been defined (no do-overs)
			let stack = this.getStackTrace(new Error());	// only a warning, but still might find stacktrace useful
			console.warn("\x1b[32m%s\x1b[0m", "WARNING: Defaults cannot be redefined, already defined in GwLogger.\n", stack);
			return null; // unable to set previously defined stream.
		}
		let logLevelStr = profileCandidate.logLevelStr;
		if (!this.isValidStr(logLevelStr)) {
			let stack = this.getStackTrace(new Error());			
			console.error("\x1b[31m%s\x1b[0m", "ERROR: createActiveProfile requires a log level, one of: "  + this.getLogLevels().join()+"\n",stack);
			process.exit(1); // All stop
		}
		logLevelStr = logLevelStr.trim().toUpperCase();
		let logLevelTmp = this.Str2NumLogLevel(logLevelStr);
		if (logLevelTmp < 0 || logLevelTmp > (this.getLogLevels().length - 1) ) {
			let stack = this.getStackTrace(new Error());			
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile tried to set unsupported log level. Must be one of: "  + this.getLogLevels().join()+"\n",stack);
			process.exit(1); // All stop
		}
		let fn = profileCandidate.fn;
		if (!this.isValidStr(fn)) {
			let stack = this.getStackTrace(new Error());			
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile requires a log file name, including any extension.\n",stack);
			process.exit(1); // All stop			
		}
		fn = fn.trim();
		this.ucFn = writePool.getUcFn(fn);
		let isFile = profileCandidate.isFile;
		if (typeof isFile !== "boolean") {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile isFile must be true or false\n",err.stack);
			process.exit(1); // All stop
		}	
		let isConsole = profileCandidate.isConsole;
		if (typeof isConsole !== "boolean") {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile isConsole must be true or false\n",err.stack);
			process.exit(1); // All stop
		}
		let isEpoch = profileCandidate.isEpoch;
		if (typeof isEpoch !== "boolean") {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile isEpoch must be true or false\n",err.stack);
			process.exit(1); // All stop
		}
		let isLocalTz = profileCandidate.isLocalTz;
		if (typeof isLocalTz !== "boolean") {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile isLocalTz must be true or false\n",err.stack);
			process.exit(1); // All stop
		}
		let nYr = profileCandidate.nYr;
		if (nYr > 4 || nYr < 0) {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile nYr must be of type Number from 0-4 (no quotes)\n",err.stack);
			process.exit(1); // All stop
		}
		let isShowMs = profileCandidate.isShowMs;
		if (typeof isShowMs !== "boolean") {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile isShowMs must be true or false\n",err.stack);
			process.exit(1); // All stop
		}
		let isConsoleTs = profileCandidate.isConsoleTs;
		if (typeof isConsoleTs !== "boolean") {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile isConsoleTs must be true or false\n",err.stack);
			process.exit(1); // All stop
		}
		
		let isRollAtStartup = profileCandidate.isRollAtStartup;
		if (typeof isRollAtStartup !== "boolean") {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile isRollAtStartup must be true or false\n",err.stack);
			process.exit(1); // All stop
		}		

		let isRollBySize = profileCandidate.isRollBySize;
		if (typeof isRollBySize !== "boolean") {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile isRollBySize must be true or false\n",err.stack);
			process.exit(1); // All stop
		}
		let maxLogSizeKb = profileCandidate.maxLogSizeKb;
		if (maxLogSizeKb < 0) {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile maxLogSizeKb must be a zero or greater Number (no quotes)\n",err.stack);
			process.exit(1); // All stop
		}
		let maxNumRollingLogs = profileCandidate.maxNumRollingLogs;
		if (maxNumRollingLogs > 20 || maxNumRollingLogs < 0) {
			let err = new Error();
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Profile maxNumRollingLogs must be of type Number from 0-20 (no quotes)\n",err.stack);
			process.exit(1); // All stop
		}
		let rollingLogPath;
		rollingLogPath = (profileCandidate.rollingLogPath) ? path.resolve(profileCandidate.rollingLogPath) : null;
		if ((isRollAtStartup || isRollBySize || rollingLogPath) && (!this.isValidStr(rollingLogPath) || !existsSync(rollingLogPath)) ) { 
			let stack = this.getStackTrace(new Error());			
			console.error("\x1b[31m%s\x1b[0m", "ERROR: Rolling logs requires an existing log file directory. check ", profileCandidate.rollingLogPath, "\n",stack);
			process.exit(1); // All stop			
		}
		if (maxLogSizeKb === 0 || maxNumRollingLogs === 0) {
			isRollBySize = false;
		} 		
		
		if (!this.activeProfile) {
			this.storeProfileData(logLevelStr, isFile, isConsole, fn, isEpoch, isLocalTz, nYr, isShowMs, isConsoleTs, isRollAtStartup, isRollBySize, maxLogSizeKb, maxNumRollingLogs, rollingLogPath );
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

	setRollingLogPath(rollingLogPath) { // the path to store old logfiles (cannot be same as logfile)
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

exports.ProfileClass = Profiles;


