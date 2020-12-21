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
/*global process, require, exports */ 

const readFileSync = require("fs").readFileSync;
const existsSync = require("fs").existsSync;
const path = require("path");
const writePool = require("./WritePool.js");
const version = "1.5.0";

class Profiles {

	constructor(profilePath, loggerId, eventEmitter, logLevel, isConsole, isFile, fn) {
		this.activeProfile = null;
		this.loggerId = loggerId;
		this.ee = eventEmitter; // EventEmitter for this logger.
		this.passedParams = {logLevel: logLevel, isConsole: isConsole, isFile: isFile, fn: fn};
		this.logLevelDefault = "OFF";
		this.tsFormatDefaults = {
			isEpoch: false, isLocalTz: true, nYr: 0, isShowMs: true
			};
		this.isConsoleTsDefault = false; // console timestamps
		this.isConsoleDefault = false;
		this.isColorDefault = true;
		this.isFileDefault = true;
		this.isRollAsArchive = false;
		this.isRollAtStartup = false;
		this.isRollBySize = false;
		this.maxLogSizeKb = 0; 
		this.maxNumRollingLogs = 0;
		this.rollingLogPath = null;
		this.archiveLogPath = null;		
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
					if (err.gwErrCode === 221) throw err;
					let defJson = this.getDefaultProfile();
					this.createActiveProfile(defJson);
				}
			}
		};	
		this.init();
		
	} // End of constructor
	
	static getVersion() { 
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
		if (typeof str === "boolean") return str;
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
				, isColor: this.isColorDefault
				, fn: this.fnDefault
				, isEpoch: this.tsFormatDefaults.isEpoch
				, isLocalTz: this.tsFormatDefaults.isLocalTz
				, nYr: this.tsFormatDefaults.nYr
				, isShowMs: this.tsFormatDefaults.isShowMs
				, isConsoleTs: this.isConsoleTsDefault
				, isRollAsArchive: this.isRollAsArchive
				, isRollAtStartup: this.isRollAtStartup
				, isRollBySize: this.isRollBySize
				, maxLogSizeKb: this.maxLogSizeKb
				, maxNumRollingLogs: this.maxNumRollingLogs
				, rollingLogPath: this.rollingLogPath
				, archiveLogPath: this.archiveLogPath
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
		//fileJson = { ...defJson, ...fileJson}; // spread doesn't work on node -v <=10,
		fileJson = Object.assign({}, defJson, fileJson); // so use this instead
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
	
	// Assumes parameter is valid
	setLogLevel(logLevelStr) {
		this.activeProfile.logLevelStr = logLevelStr;	
	}
	
	getLogLevel() {
		return this.activeProfile.logLevelStr;
	}

	setIsFile(b) {
		this.activeProfile.isFile = b;
	}
	
	getIsFile() {
		return this.activeProfile.isFile;
	}
	
	setIsConsole(b) {
		this.activeProfile.isConsole = b;
	}
	
	getIsConsole() {
		return this.activeProfile.isConsole;
	}	
	
	setFn(path) { // assumes valid path
		this.activeProfile.fn = path;
	}
	
	getFn() {
		return this.activeProfile.fn;
	}

	setUcFn(ucFn) { // assumes valid ucFn
		//this.activeProfile.ucFn = ucFn;
		this.ucFn = ucFn;
	}
	
	getUcFn() {
		return this.activeProfile.ucFn;
	}	
	
	Str2NumLogLevel(levelStr) {
		let logLevelStr = levelStr.trim().toUpperCase();
		if (!logLevelStr) return null;
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
		if (!fn || !(this.fnPath = this.checkPath(fn))) {
			this.ee.emit("error", 2001, msg.errNoLog01(fn));
		}
		return writePool.getStream(fn, false, this.getActiveProfile());			
	}
	
	newCustomWriteStream(fn) { 	
		if (!fn || !(this.fnPath = this.checkPath(fn))) {
			this.ee.emit("error", 2001, msg.errNoLog01(fn));	
		}
		return writePool.getStream(fn, false, this.getActiveProfile());			
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
		
	storeProfileData(logLevelStr, isFile, isConsole, isColor, fn, isEpoch
			, isLocalTz, nYr
			, isShowMs, isConsoleTs, isRollAsArchive, isRollAtStartup
			, isRollBySize, maxLogSizeKb
			, maxNumRollingLogs, rollingLogPath
			, archiveLogPath) {
		// Will overwrite existing profile data, if any
		this.activeProfile = {fn: fn, logLevelStr: logLevelStr, 
			isFile: isFile, isConsole: isConsole, isColor: isColor
			, isEpoch: isEpoch
			, isLocalTz: isLocalTz, nYr: nYr
			, isShowMs: isShowMs, isConsoleTs: isConsoleTs
			, isRollAsArchive: isRollAsArchive
			, isRollAtStartup: isRollAtStartup, isRollBySize: isRollBySize
			, maxLogSizeKb: maxLogSizeKb
			, maxNumRollingLogs: maxNumRollingLogs, rollingLogPath: rollingLogPath
			, archiveLogPath: archiveLogPath
			, loggerId: this.loggerId};
		return;
	}	

	// profileCandidate is an object created from env vars, the JSON profile or 
	// from built-in defaults.
	createActiveProfile(profileCandidate) { 
		let nConfigError = 0;
		let errorList = [];
		let result;
		if (this.activeProfile) { // don't do this twice
			return null; // unable to set previously defined stream.
		}
		let logLevelStr = profileCandidate.logLevelStr;	
		if (this.passedParams.logLevel && this.passedParams.logLevel !== null) {
			logLevelStr = this.passedParams.logLevel.trim().toUpperCase();
		}
		if (!this.isValidStr(logLevelStr)) {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errNoLL01(this.getLogLevels().join()));
		} else {
			let logLevelTmp = this.Str2NumLogLevel(logLevelStr);		
			if (logLevelTmp && logLevelTmp < 0 || logLevelTmp > (this.getLogLevels().length - 1) ) {
				nConfigError++;
				errorList.push("#"+nConfigError+". "+msg.errNoLL02(logLevelStr, this.getLogLevels().join()));
			}
		}
		
		let fn  = profileCandidate.fn;
		if (this.passedParams.fn && this.passedParams.fn !== null) {
			fn = this.passedParams.fn.trim();
		}
		if (!this.isValidStr(fn)) {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errNoLog04(fn));
		}
		this.fnPath = this.checkPath(fn);
		if (!this.fnPath) {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errNoLog01(fn));
		}		
		this.ucFn = writePool.getUcFn(fn);
		
		//if user passed it non-null, it needs to be right, or throw (don't default)
		let isFile = profileCandidate.isFile;
		result = isFile;
		if (this.passedParams.isFile !== undefined && this.passedParams.isFile !== null) {
			isFile = this.passedParams.isFile;
		}
		result = this.str2Bool(isFile); // returns null if invalid	
		if (typeof result !== "boolean") {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errPTF01("isFile", isFile));
		} else isFile = result;	

		let isConsole = profileCandidate.isConsole;
		result = isConsole;
		if (this.passedParams.isConsole !== undefined && this.passedParams.isConsole !== null) {
			isConsole = this.passedParams.isConsole;
		}
		result = this.str2Bool(isConsole);
			
		if (typeof result !== "boolean") {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errPTF01("isConsole", isConsole));
		} else isConsole = result;

		let isColor = profileCandidate.isColor;
		if (typeof isColor !== "boolean") {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errPTF01("isColor", isColor));
		}

		let isEpoch = profileCandidate.isEpoch;			
		if (typeof isEpoch !== "boolean") {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errPTF01("isEpoch", isEpoch));
		}

		let isLocalTz = profileCandidate.isLocalTz;		
		if (typeof isLocalTz !== "boolean") {
			nConfigError++;	
			errorList.push("#"+nConfigError+". "+msg.errPTF01("isLocalTz", isLocalTz));				
		}
		let nYr = profileCandidate.nYr;	
		if (nYr > 4 || nYr < 0) {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errYr01(nYr));
		}
		let isShowMs = profileCandidate.isShowMs;		
		if (typeof isShowMs !== "boolean") {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errPTF01("isShowMS", isShowMs));	
		}
		let isConsoleTs = profileCandidate.isConsoleTs;	
		if (typeof isConsoleTs !== "boolean") {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errPTF01("isConsoleTs", isConsoleTs));
		}

		let isRollAsArchive = profileCandidate.isRollAsArchive;	
		if (typeof isRollAsArchive !== "boolean") {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errPTF01("isRollAsArchive", isRollAsArchive));
		}
		
		let isRollAtStartup = profileCandidate.isRollAtStartup;	
		if (typeof isRollAtStartup !== "boolean") {	
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errPTF01("isRollAtStartup", isRollAtStartup));
		}		

		let isRollBySize = profileCandidate.isRollBySize;		
		if (typeof isRollBySize !== "boolean") {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errPTF01("isRollBySize", isRollBySize));
		}
		let maxLogSizeKb = profileCandidate.maxLogSizeKb;			
		if (typeof maxLogSizeKb !== "number" || maxLogSizeKb < 0) {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errLs01(maxLogSizeKb));
		}
		
		let maxNumRollingLogs = profileCandidate.maxNumRollingLogs;	
		if (typeof maxNumRollingLogs !== "number" || maxNumRollingLogs > 20 || maxNumRollingLogs < 0) {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errNL01(maxNumRollingLogs));
		}
		let rollingLogPath;
		rollingLogPath = (profileCandidate.rollingLogPath) 
			? path.resolve(profileCandidate.rollingLogPath) 
			: null;
		if ((rollingLogPath) 
				&& (!this.isValidStr(rollingLogPath) 
					|| !existsSync(rollingLogPath)) ) { 
			nConfigError++;	
			errorList.push("#"+nConfigError+". "+msg.errRp01(rollingLogPath));
		}
		if (maxLogSizeKb === 0 || (!isRollAsArchive && maxNumRollingLogs === 0)) {
			isRollBySize = false;
		} 

		let archiveLogPath;
		archiveLogPath = (profileCandidate.archiveLogPath)
			? path.resolve(profileCandidate.archiveLogPath)
			: null;
		if (archiveLogPath
					&& (!this.isValidStr(archiveLogPath) 
					|| !existsSync(archiveLogPath)) ) {
			nConfigError++;
			errorList.push("#"+nConfigError+". "+msg.errRp02(archiveLogPath));			
		}
		
		// If any config errors were found, throw the config error
		if (nConfigError > 0) {
			throw {location: "GwLogger.Profiles.createActiveProfile"
			, gwErrCode: 221
			, message: msg.errConfig
			, errorList: errorList};			
		}
		
		if (!this.activeProfile) {
			this.storeProfileData(
				logLevelStr, isFile, isConsole, isColor, fn, isEpoch, isLocalTz
				, nYr, isShowMs, isConsoleTs, isRollAsArchive, isRollAtStartup
				, isRollBySize, maxLogSizeKb, maxNumRollingLogs, rollingLogPath
				, archiveLogPath);
			return;
		}	
	}
	
	// roll at Startup settings
	setIsRollAtStartup(b) { 
		this.activeProfile.isRollAtStartup = b;
		writePool.setIsRollAtStartup(this.ucFn, b);
		return this.activeProfile.isRollAtStartup;
	}	
	getIsRollAtStartup() {
		return this.activeProfile.isRollAtStartup;
	}	

	// roll as Archive settings
	setIsRollAsArchive(b) { 	
		this.activeProfile.isRollAsArchive = b;
		writePool.setIsRollAsArchive(this.ucFn, b);
		return this.activeProfile.isRollAsArchive;
	}	
	getIsRollAsArchive() {
		return this.activeProfile.isRollAsArchive;
	}
	
	// roll by size settings
	setIsRollBySize(b) {
		this.activeProfile.isRollBySize = b;
		writePool.setIsRollBySize(this.ucFn, b);
		return this.activeProfile.isRollBySize;
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
		this.maxLogSizeKb = kb;
		this.activeProfile.maxLogSizeKb = kb;		
		writePool.setMaxLogSizeKb(this.ucFn, kb);
		return this.activeProfile.maxLogSizeKb;
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
		return this.activeProfile.maxNumRollingLogs;
	}	
	getMaxNumRollingLogs() {
		return this.activeProfile.maxNumRollingLogs;
	}

	setRollingLogPath(rollingLogPath) {
		if (rollingLogPath) {
			rollingLogPath = rollingLogPath.trim();
			rollingLogPath = path.resolve(rollingLogPath);
			if (!existsSync(rollingLogPath) ) {
				return false; // bad path
			}
		}
		this.activeProfile.rollingLogPath = rollingLogPath;
		
		writePool.setRollingLogPath(this.ucFn, rollingLogPath);
		return this.activeProfile.rollingLogPath;
	}	
	getRollingLogPath() {
		return this.activeProfile.rollingLogPath;
	}

	setArchiveLogPath(archiveLogPath) {
		if (archiveLogPath) {
			archiveLogPath = archiveLogPath.trim();
			archiveLogPath = path.resolve(archiveLogPath);
			if (!existsSync(archiveLogPath) ) {
				return false; // bad path
			}
		}
		this.activeProfile.archiveLogPath = archiveLogPath;
		writePool.setArchiveLogPath(this.ucFn, archiveLogPath);
		return this.activeProfile.archiveLogPath;
	}	
	getArchiveLogPath() {
		return this.activeProfile.archiveLogPath;
	}
	

} // end of Profiles class


const msg = {
	errConfig: "ERROR: Configuration error during GwLogger startup. See errorList for details.",
	errNoLog01: (s1) => {return `ERROR: Could not find directory for this logfile: ${s1}`;},
	errNoLL01: (s1) => {return `ERROR: Profile requires a log level, one of: ${s1}`;},
	errNoLL02: (s1, s2) => {return `ERROR: Profile tried to set unknown log level of: ${s1}. Must be one of: ${s2}`;},
	errNoLog04: "ERROR: Profile requires a logfile name including extensions.",
	errPTF01: (s1, s2) => {return `ERROR: Profile ${s1} must be true or false. Found: ${s2}`;},
	errYr01: (s1) => {return `ERROR: Profile nYr must be of type Number from 0-4. Found: ${s1}`;},
	errLs01: (s1) => {return `ERROR: Profile maxLogSizeKb must be a zero or greater Number. Found: ${s1}`;},
	errNL01: (s1) => {return `ERROR: Profile maxNumRollingLogs must be of type Number from 0-20. Found: ${s1}`;},	
	errRp01: (s1) => {return `ERROR: Rolling logs require an existing directory, but ${s1} does not exist.`;},
	errRp02: (s1) => {return `ERROR: Archived logfiles require an existing directory, but ${s1} does not exist.`;}
};	


exports.ProfileClass = Profiles;


