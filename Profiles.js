"use strict";

/**
 * @overview Profiles.js creates and stores the profile data for a GwLogger.
 * It can gather data from environment variables or JSON files.
 * It contains built-in defaults, overlaying those settings with
 * the other gathered data, and stores the resulting activeProfile.
 *
 * Starting in GwLogger version 1.1.0, each instance of GwLogger has 
 * its own associated instance of Profiles.
 *
 * All functions herein are only used internally. Methods and objects 
 * may change their form, function, or be removed.
 *
*/

// A directive for exceptions to ESLint no-init rule
/*global process, require, exports */ 

const readFileSync = require("fs").readFileSync;
const existsSync = require("fs").existsSync;
const path = require("path");
const writePool = require("./WritePool.js");
const version = "1.5.2";

/**
 * @class
 * @private
 * @desc One instance of this class is used by a matching instance of GwLogger to
 * store and manage profile settings.
 * @param {string} profilePath - user-defined path to a JSON profile, or null.
 * @param {string} loggerId - unique ID for an instance of GwLogger.
 * @param {object} eventEmitter - EventEmitter for this logger.
 * @param {string} logLevel - off, fatal, error, etc. 
 * This was a Passed param from GwLogger's constructor.
 * @param {boolean} isConsole - true to log to console. 
 * This was a Passed param from GwLogger's constructor.
 * @param {boolean} isFile - true to log to file. 
 * This was a Passed param from GwLogger's constructor.
 * @param {string} fn - name of file to log to, or null if not using logfiles. 
 * This was a Passed param from GwLogger's constructor.
*/
class Profiles {
	constructor(profilePath, loggerId, eventEmitter, logLevel, isConsole, isFile, fn) {
		this.activeProfile = null;
		this.loggerId = loggerId;
		this.ee = eventEmitter; 
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
	
	/** 
	 * @desc Test instrumentation.
	 * @returns {string} Profiles.js version number. */
	static getVersion() { 
		return version;
	}
	
	/**
	 * @desc For verifying a file spec that is entered by user. Returns a path, only if 
	 * path was valid and exists already, else null.
	 * @param {string} pathWithFn - A file name entered by user.
	 * @returns {string} A path name. 
	 * @private 
	*/
	checkPath(pathWithFn) {
		let p, endPath;
		// Trial and Error, since can sometimes expect '/' or '\' from Win users
		endPath = pathWithFn.lastIndexOf("\\");
		if (endPath === -1) endPath = pathWithFn.lastIndexOf("/");
		p = pathWithFn.substring(0,endPath + 1);
		p = ( p && existsSync(p)) ? p : null;
		return (p) ? path.resolve(p) : null;
	}

	/**
	 * @desc Checks for a string type with length > 0
	 * @param {string} str - a string candidate
	 * @returns {boolean} true if a valid string with length > 0
	 * @private 
	*/
	isValidStr(str) {
		if (typeof str === "string" && str.length > 0) {
		return true;
		}
		else {
			return false;
		}
	}
	
	/**
	 * @desc Converts a string, like "true" or "false" to actual boolean. 
	 * @param {string} str - string to convert. 
	 * @returns {boolean} true or false, or null is not either.
	 * @private 
	*/
	str2Bool(str) {
		if (typeof str === "boolean") return str;
		if (this.isValidStr(str)) {
			str = str.trim().toLowerCase();
			if (str === "true") return true;
			if (str === "false") return false;
		}
		return null; // not a boolean
	}

	/**
	 * @desc Checks string to ensure is a valid number.
	 * @param {string} str - string to check.
	 * @returns {boolean} true if valid number, or false.
	 * @private 
	*/
	isNumber(str) {
		return !isNaN(parseFloat(str)) && isFinite(str);
	}

	/**
	 * @desc Converts a string to another type if reasonable.
	 * coerce is limited to strings, booleans, and integers.
	 * @param {string} str - string to convert or clean-up. 
	 * @returns {boolean} true or false, or a trimmed string. 
	 * @private 
	*/
	coerce(str) {
		let b = this.str2Bool(str);
		if (b !== null) return b; // return the boolean
		return this.isNumber(str)
			? parseInt(str) // watch for nYr or other integer value
			: str.trim(); // return a string
	}

	/**
	 * @desc Packs the default values into one larger JSON object. 
	 * @returns {object} A JSON profile object with defaults.
	 * @private
	*/
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
	
	/**
	 * @desc Reads a JSON profile from disk and fills in missing 
	 * values with defaults.
	 * @returns {object} A JSON profile object, or null if no 
	 * GwLogger.json or user-defined profile was defined/found.
	 * @private
	*/	
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

	/**
	 * @desc Reads the environment variables, and fills-in missing 
	 * values with defaults.
	 * @returns {object} A JSON profile object with defaults, or null
	 * if no environment variables were defined by user.
	 * @private
	*/		
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

	/**
	 * @returns {array} An array of logLevel strings.
	 * @private 
	 */
	getLogLevels() {
		return ["OFF", "FATAL", "ERROR", "WARN", "NOTICE", "INFO", "DEV", "DEBUG"
			, "TRACE", "ALL"];
	}
	
	/**
	 * @desc Assigns a new logLevel string to the active profile.
	 * @param {string} logLevelStr - the new logLevel. Assume already validated.
	 * @private 
	 */	
	setLogLevel(logLevelStr) {
		this.activeProfile.logLevelStr = logLevelStr;	
	}
	
	/**
	 * @returns {string} The current logLevel. 
	 * @private 
	*/
	getLogLevel() {
		return this.activeProfile.logLevelStr;
	}

	/** 
	 * @param {boolean} b - true to log to logfile. 
	 * @private
	*/
	setIsFile(b) {
		this.activeProfile.isFile = b;
	}

	/** 
	 * @returns {boolean} true to log to logfile. 
	 * @private
	*/	
	getIsFile() {
		return this.activeProfile.isFile;
	}

	/** 
	 * @param {boolean} b - true to log to console/stdout. 
	 * @private
	*/	
	setIsConsole(b) {
		this.activeProfile.isConsole = b;
	}

	/** 
	 * @returns {boolean} true to log to console/stdout. 
	 * @private
	*/	
	getIsConsole() {
		return this.activeProfile.isConsole;
	}	

	/** 
	 * @desc Sets the logfile name in the profile. 
	 * @param {string} path - A previously verified path name.  
	 * @private
	*/	
	setFn(path) {
		this.activeProfile.fn = path;
	}

	/** 
	 * @returns {string} path - The logfile path name.  
	 * @private
	*/	
	getFn() {
		return this.activeProfile.fn;
	}

	/** 
	 * @desc Saves ucFn (used for a key to ID logfiles).
	 * @param {string} ucFn - The logfile path upper-case sans whitespace.  
	 * @private
	*/
	setUcFn(ucFn) { // assumes valid ucFn
		//this.activeProfile.ucFn = ucFn;
		this.ucFn = ucFn;
	}

	/** 
	 * @desc Returns ucFn (used for a key to ID logfiles).
	 * @return {string} ucFn - The logfile path upper-case sans whitespace.  
	 * @private
	*/	
	getUcFn() {
		return this.activeProfile.ucFn;
	}	
	
	/** 
	 * @param {string} logLevelStr - A logLevel in string form.
	 * @returns {number} The numeric representation of the logLevelStr.
	 * @private
	*/	
	Str2NumLogLevel(levelStr) {
		let logLevelStr = levelStr.trim().toUpperCase();
		if (!logLevelStr) return null;
		let logLevel = 
			this.getLogLevels().findIndex(level => level === logLevelStr);
		return logLevel;
	}	

	/**
	 * @returns {object} The current active profile. 
	 * @private 
	*/
	getActiveProfile() {
		if (!this.activeProfile) {
			return null;
		}
		else {
			return this.activeProfile;
		}
	}

	/**
	 * @desc Verify or Create a write stream for the specified logfile.
	 * Find an existing writeStream for file, or create a new one.
	 * This activity can go async in WritePool, and nothing is returned here.
	 * @param {string} fn - file path/name for logfile. 
	 * @private 
	*/
	verifyCreateWriteStream(fn) { 	
		if (!fn || !(this.fnPath = this.checkPath(fn))) {
			this.ee.emit("error", 2001, msg.errNoLog01(fn));	
		}
		writePool.verifyCreateWriteStream(fn, false, this.getActiveProfile());			
	}
	
	/**
	 * @desc test instrumentation.
	 * @private
	*/
	deleteProfileData() {
		// are you sure? This should only be done during testing.
		this.activeProfile = null;
	}
	
	/**
	 * @desc Test instrumentation.
	 * @private
	*/
	getProfileData() {
		return this.activeProfile;
	}
	
	/**
	 * @desc Test instrumentation.
	 * @param {object} p - active profile. 
	 * @private
	*/
	setProfileData(p) {
		// are you sure? This should only be done during testing.
		this.activeProfile = p;
	}
	
	/**
	 * @desc Collects all determined profile values and loads them into the 
	 * activeProfile object.
	 * @param {string} logLevelStr
	 * @param {boolean} isFile
	 * @param {boolean} isConsole
	 * @param {boolean} isColor
	 * @param {string} fn
	 * @param {boolean} isEpoch
	 * @param {boolean} isLocalTz
	 * @param {number} nYr
	 * @param {boolean} isShowMs
	 * @param {boolean} isConsoleTs
	 * @param {boolean} isRollAsArchive
	 * @param {boolean} isRollAtStartup
	 * @param {boolean} isRollBySize
	 * @param {number} maxLogSizeKb
	 * @param {number} maxNumRollingLogs
	 * @param {string} rollingLogPath
	 * @param {string} archiveLogPath	 
	 * @private 
	*/
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

	/**
	 * @desc profileCandidate is an object created from env vars, the JSON profile or 
	 * from built-in defaults.
	 * @param {object} profileCandidate - An object with all attribute/value 
	 * pairs to validate and store.
	 * @private 
	*/
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
	
	/**
	 * @desc Set roll-at-Startup settings.
	 * @param {boolean} b - true to roll at startup. 
	 * @returns Current setting after change.
	 * @private 
	*/
	setIsRollAtStartup(b) { 
		this.activeProfile.isRollAtStartup = b;
		writePool.setIsRollAtStartup(this.ucFn, b);
		return this.activeProfile.isRollAtStartup;
	}
	/**
	 * @returns {boolean} Current setting
	 * @private 
	*/	
	getIsRollAtStartup() {
		return this.activeProfile.isRollAtStartup;
	}	

	/**
	 * @desc Set roll last rolled file or logfile as a compressed file (archive).
	 * @param {boolean} b - true to roll as archive. 
	 * @returns {boolean} Current value. 
	 * @private 
	*/	
	setIsRollAsArchive(b) { 	
		this.activeProfile.isRollAsArchive = b;
		writePool.setIsRollAsArchive(this.ucFn, b);
		return this.activeProfile.isRollAsArchive;
	}
	/**
	 * @returns {boolean} Current setting.
	 * @private 
	*/
	getIsRollAsArchive() {
		return this.activeProfile.isRollAsArchive;
	}
	
	// 
	/**
	 * @desc Set roll by size setting.
	 * @param {boolean} b - true to roll-by-size.
	 * @returns Current value after setting. 
	 * @private 
	*/	
	setIsRollBySize(b) {
		this.activeProfile.isRollBySize = b;
		writePool.setIsRollBySize(this.ucFn, b);
		return this.activeProfile.isRollBySize;
	}
	/**
	 * @returns {boolean} Current profile setting. 
	 * @private 
	*/	
	getIsRollBySize() {
		return this.activeProfile.isRollBySize;
	}

	/**
	 * @desc Set cut-off size for logfile to roll.
	 * @param {number} kb - Size in KB.
	 * @returns {number|null} Current setting after change, or null if error. 
	 * @private 
	*/	
	setMaxLogSizeKb(kb) { // approx max of each logfile.
		if (kb < 0) { 
			return null;
		}
		this.maxLogSizeKb = kb;
		this.activeProfile.maxLogSizeKb = kb;		
		writePool.setMaxLogSizeKb(this.ucFn, kb);
		return this.activeProfile.maxLogSizeKb;
	}
	/**
	 * @returns {number} Current setting in KB.
	 * @private 
	*/	
	getMaxLogSizeKb() {
		return this.activeProfile.maxLogSizeKb;
	}

	/**
	 * @desc Set maximum number of rolled-logs to save before either deleting 
	 * them or rolling them to an archive.
	 * @param {number} n - How many logfiles to keep
	 * @returns {number} Current setting after change or null if invalid.
	 * @private 
	*/
	setMaxNumRollingLogs(n) {
		if (n > 20 || n < 0) {
			return null;
		}
		this.activeProfile.maxNumRollingLogs = n;
		writePool.setMaxNumRollingLogs(this.ucFn, n);
		return this.activeProfile.maxNumRollingLogs;
	}
	/**
	 * @returns {number} Current value.
	 * @private 
	*/	
	getMaxNumRollingLogs() {
		return this.activeProfile.maxNumRollingLogs;
	}

	/**
	 * @desc Set path for rolled logs. 
	 * @param {string} rollingLogPath - new path to use. 
	 * @returns {string|boolean} Current setting or if a bad path then false.
	 * @private 
	*/
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
	/**
	 * @returns {string} Current setting. 
	 * @private 
	*/	
	getRollingLogPath() {
		return this.activeProfile.rollingLogPath;
	}

	/**
	 * @desc  Set path for archived logs. 
	 * @param {string} archiveLogPath - Path to store compressed logfiles. 
	 * @returns {string|boolean} Current setting or if bad path then false.
	 * @private 
	*/
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
	/** 
	 * @returns {string} Current setting for archive log path
	 * @private 
	*/	
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


