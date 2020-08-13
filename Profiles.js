"use strict";
/*
import { readFileSync, existsSync } from "fs";
import { writePool } from "./WritePool.js";
*/
const readFileSync = require("fs").readFileSync;
const existsSync = require("fs").existsSync;
const writePool = require("./WritePool.js");

/*global console, process, require */ // A directive for exceptions to ESLint no-init rule
class Profiles {

	constructor() {

		this.activeProfile = null;
		this.logLevelDefault = "OFF";
		this.tsFormatDefaults = {isEpoch: false, isLocalTz: true, nYr: 0, isShowMs: true};
		this.isConsoleTsDefault = false; // console timestamps
		this.isConsoleDefault = false;
		this.isFileDefault = true;
		this.path_separator = (process.platform.startsWith("win")) ? "\\" : "/"; // okay here, but not always trustworthy, see checkPath(fn);
		this.path = process.cwd() + this.path_separator;// this.mainExec.substring(0,this.endPath);
		this.fnDefault = this.path + "gwl_log.log";
		this.profileName = this.path + "GwLogger.json";
		this.customStreams = {}; // to hold: {"./MYDIR/MYLOGFILE": <ws>}
	
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
				} catch(err) { // no profile, so use built-in defaults to get started, TODO, using catch for normal path!!?
					let defJson = this.getDefaultProfile();
					this.createActiveProfile(defJson);
				}
			}
		};	
		this.init();
		
	} // End of constructor
	
	checkPath(pathWithFn) {
		let p, endPath;
		endPath = pathWithFn.lastIndexOf("\\");
		if (endPath === -1) endPath = pathWithFn.lastIndexOf("/"); // Trial and Error
		p = pathWithFn.substring(0,endPath + 1);
		return existsSync(p);
	}
	
	getStackTrace(err) { // Trims stacktrace to point at perpetrator
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
			isShowMs: this.tsFormatDefaults.isShowMs, isConsoleTs: this.isConsoleTsDefault};
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
		let envJson = {logLevelStr: this.logLevelDefault, isFile: this.isFileDefault, isConsole: this.isConsoleDefault, fn: this.fnDefault, 
			isEpoch: this.tsFormatDefaults.isEpoch,  isLocalTz: this.tsFormatDefaults.isLocalTz, nYr: this.tsFormatDefaults.nYr, 
			isShowMs: this.tsFormatDefaults.isShowMs, isConsoleTs: this.isConsoleTsDefault};
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
		try { 
			return this.newCustomWriteStream(fn);
		} catch(err) {
			throw("Unlikely logfile path or other issue while creating a new profile logging file stream in GwLogger.\n" + err);
		}		
	}
	
	newCustomWriteStream(fn) {
		try {
			if (!fn || !this.checkPath(fn)) {
				let stack = this.getStackTrace(new Error());			
				console.error("\x1b[31m%s\x1b[0m", "ERROR: Could not find path for logfile: ", fn, "\n",stack);
				throw("Could not find path for logfile.");		
			}
			return writePool.registeredStream(fn); // gets or creates a stream for this fn
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
	
	storeProfileData(logLevelStr, isFile, isConsole, fn, isEpoch, isLocalTz, nYr, isShowMs, isConsoleTs) {
		// Will overwrite previous defaults, if any
		this.activeProfile = {fn: fn, logLevelStr: logLevelStr, 
			isFile: isFile, isConsole: isConsole, isEpoch: isEpoch, isLocalTz: isLocalTz, nYr: nYr,
			isShowMs: isShowMs, isConsoleTs: isConsoleTs};
		return;
	}	
	
	createActiveProfile(profileCandidate) { //profileCandidate (default JSON) is an object created from the JSON profile or from built-in defaults.
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
		if (!this.activeProfile) {
			this.storeProfileData(logLevelStr, isFile, isConsole, fn, isEpoch, isLocalTz, nYr, isShowMs, isConsoleTs);
			return;
		}	
	}

} // end of Profiles class

const profiles = new Profiles();
/*
export { profiles };
*/

module.exports = profiles;

