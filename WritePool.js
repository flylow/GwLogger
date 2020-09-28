"use strict";
/**
 * WritePool manages pools of streams and logfiles, and rolls
 * logfiles when/if specified.
 *
 * It helps ensure that any of the user's instances of GwLogger that log to the 
 * same logfile will write to the same writeStream rather than creating 
 * another one on a different buffer. 
 *
 *
*/

/*global module, console, setTimeout, require */ // A directive for exceptions to ESLint no-init rule

const createWriteStream = require("fs").createWriteStream;
const watch = require("fs").watch;
const existsSync = require("fs").existsSync;
const path = require("path");
const statSync = require("fs").statSync;
const closeSync = require("fs").closeSync;
const openSync = require("fs").openSync;

const moveFile = require("./fsprom.js").moveFile;
const unlinkFile = require("./fsprom.js").unlinkFile;

let registeredStreams = {}; // contains writeStreams
let logFiles = {}; // contains LogFileRecs

// Most buffering occurs inside the stream object, as usual for writestreams. But during a roll event,
// a localQueue, defined below, takes over. Buffering to the localQueue usually only happens for a short period 
// while waiting for the outgoing file to receive remainder of any buffer still held by an ended writestream.


// Holds properties and state information for a logfile
class LogFileRec {
	constructor (isRollBySize = false, rollingLogPath = null, maxNumRollingLogs = 0, maxLogSizeKb = 0) {
		this.isRollBySize = isRollBySize; // A flag that indicates rolling is turned-on
		this.rollingLogPath = rollingLogPath;
		this.maxNumRollingLogs = maxNumRollingLogs;
		this.maxLogSizeKb = maxLogSizeKb;
		
		this.isRolling = false; // This file is currently involved in the rolling process
		
		this.isQueuing = false; // A flag that re-directs logging to an internal queue during rolling or recovery
		this.localQueue = []; // The internal queue for this logfile
		
		this.startSizeKb = 0; // The size, in KB, of the logfile at startup, or 0 (zero) when created by GwLogger.
		this.birthTimeMs = null; // Timestamp for logfile's creation date/time.

		this.isInRecovery = false; // If a log file is accidentally removed/renamed, a recovery process ensues to re-create
	}
}


class WritePool {
	constructor () {
		this.CHECK_FREQUENCY = 20; // every nth write attempt will see if file needs rolled for size
		this.checked = 0; // A counter incremented after each check on roll by size.
	}	
	
	// ucFn is "upper-case file name" without any whitespace. Used as a key for log records and streams
	getUcFn(fn) { 
		if (!fn) return null;
		fn = path.resolve(fn);
		return fn.replace(/\s+/g, "").toUpperCase();
	}
	
	// 		methods for roll by size settings
	
	setIsRollBySize(ucFn, b) {
		logFiles[ucFn].isRollBySize = b;
	}	
	getIsRollBySize(ucFn) {
		return (logFiles && logFiles[ucFn]) ? logFiles[ucFn].isRollBySize : null;
	}
	
	setMaxLogSizeKb(ucFn, kb) { // approx max of each logfile
		this.setIsRollBySize(ucFn, false);
		logFiles[ucFn].maxLogSizeKb = kb;
	}
	getMaxLogSizeKb(ucFn) {
		return (logFiles && logFiles[ucFn]) ? logFiles[ucFn].maxLogSizeKb : null;
	}

	setMaxNumRollingLogs(ucFn, n) { // how many logfiles to keep
		this.setIsRollBySize(ucFn, false);
		logFiles[ucFn].maxNumRollingLogs = n;
	}	
	getMaxNumRollingLogs(ucFn) {
		return (logFiles && logFiles[ucFn]) ? logFiles[ucFn].maxNumRollingLogs : null;
	}

	setRollingLogPath(ucFn, rollPath) { // the path to store old logfiles (cannot be same as logfile, etc.)
		this.setIsRollBySize(ucFn, false);
		if (!rollPath) {
			logFiles[ucFn].rollingLogPath = null;
			return false;
		}
		rollPath = rollPath.trim();
		rollPath = path.resolve(rollPath);
		//let fn = logFiles[ucFn].fn; // TODO, no longer needed (to restrict directory)?
		//let rFn = path.resolve(fn); // normal logfile directory path
		//let pFn = path.parse(rFn);
		//pFn = (pFn) ? pFn.dir : null;
		if (!existsSync(rollPath) ) { //|| rollPath === pFn) {
			return false;
		}
		logFiles[ucFn].rollingLogPath = rollPath;
		return true;
	}	
	getRollingLogPath(ucFn) {
		return (logFiles && logFiles[ucFn]) ? logFiles[ucFn].rollingLogPath : null;
	}
	
	getWritableLengthKb(ucFn) { // Determines the size of the writeStream's buffer (which will impact eventual logfile size)
		if (!registeredStreams || !registeredStreams[ucFn] || !registeredStreams[ucFn].ws) return null;
		let ws = registeredStreams[ucFn].ws;
		return Math.round(ws.writableLength/1024);
	}
	
	getIsQueuing(ucFn) { // test instrumentation
		if (!logFiles || !logFiles[ucFn] || logFiles[ucFn].isQueuing === undefined
			|| logFiles[ucFn].isQueuing === null) {
				return false;
			}
		return logFiles[ucFn].isQueuing;
	}
	
	getIsRolling(ucFn) { // test instrumentation
		if (!logFiles || !logFiles[ucFn] || logFiles[ucFn].isRolling === undefined
			|| logFiles[ucFn].isRolling === null) {
				return false;
			}
		return logFiles[ucFn].isRolling;
	}	
	
	// Check if logfile size estimate is larger than target max set by user
	getNeedToRollSize(ws, ucFn) {
		if (ucFn && !ws) { // no ws happens at startup, so zero-sized ws buffer; plus, ws and the ws buffer may not exist yet.
			if (logFiles[ucFn].startSizeKb  > logFiles[ucFn].maxLogSizeKb) {
				return true;
			}	
			else return false; 
		}
		
		let currentSize = logFiles[ucFn].startSizeKb + ws.bytesWritten/1024 + ws.writableLength/1024;
		if (currentSize > logFiles[ucFn].maxLogSizeKb) {
			return true;
		} else
		{
			return false;
		}
	}

	// Will add the items in nuBits to the registeredStreams record
	updateRecord(fn, nuBits) { // TODO, pass in ucFn instead of fn?
		let record;
		let ucFn = this.getUcFn(fn); 
		record = registeredStreams[ucFn];	
		if (!record) return null;
		record = {...record, ...nuBits};
		registeredStreams[ucFn] = record;
		return record;
		
	}
		
	// Returns a stream for a given logfile. May have to create it, or replace it during rolling
	getRegisteredStream(fn, replace=false) {
		let ws;
		let record;
		let ucFn = this.getUcFn(fn);
		record = registeredStreams[ucFn];
		if (record && record.ws && !replace) {
			return ws;
		}
		if (replace && record) {
			try {
				if (record.watcher) {
					record.watcher.close();
					record.watcher = null;
				}
			}
			catch(err) {
				console.error("Error closing record.watcher or ending stream for fn: ", fn, ", error is: ", err);
			}
		}	
		if (replace && record && record.fd) {
			record.fd = null;
		}
		registeredStreams[ucFn] = {}; // clean slate for this file record
		writePool.touch(fn);
		ws = writePool.createCustomWriter(fn); // creates a new stream, and (re-)creates a logfile
		registeredStreams[ucFn].ws = ws;
		return ws;		
	}
	
	// Check to see if it is time to roll	
	checkRollingFiles() { 
	let ws;
		for (let ucFn in logFiles) {
			if (logFiles[ucFn].isRollBySize && !logFiles[ucFn].isRolling && !logFiles[ucFn].isInRecovery 
					&& logFiles[ucFn].maxLogSizeKb > 0 && logFiles[ucFn].maxNumRollingLogs > 0) {
				ws = registeredStreams[ucFn].ws;
				if (this.getNeedToRollSize(ws, ucFn)) {
					//++++++++ Need to roll due to size
					logFiles[ucFn].isRolling = true;
					logFiles[ucFn].isQueuing = true;
					this.rollFiles(ucFn); // async here to roll files
				}
			}
		}
	}
	
	// Perform logfile roll
	async rollFiles(ucFn) {
		let fn = logFiles[ucFn].fn;
		let ws = (registeredStreams[ucFn] && registeredStreams[ucFn].ws) ? registeredStreams[ucFn].ws : null;
		let rollFileName = "", nuName = "", tmpName = "";
		let rollingLogPath = logFiles[ucFn].rollingLogPath;
		let fnPath = path.parse(fn);		
		// move current logfile to temporary stash
		tmpName = rollingLogPath + "/" + "GWL_tmp_" + fnPath.name + fnPath.ext;
		try{
			if (registeredStreams[ucFn] && registeredStreams[ucFn].watcher) {
				registeredStreams[ucFn].watcher.close();
			}			
			if (existsSync(fn)) await moveFile(fn, tmpName);
		} catch(err) {
			// no-op // TODO, need a better plan :(
			console.error("In rollFiles with error", err);
		}			
		if (ws) ws.end(); // An existing stream will continue writing in the rollingLogPath location until stream-buffer empty and stream ends/closes.
		
		try {
			for (let i = logFiles[ucFn].maxNumRollingLogs; i > 0; i--) {
				let j = i + 1;
				rollFileName = rollingLogPath + "/" + fnPath.name + "_" + (""+i).padStart(3,0) + fnPath.ext; 
				if (i === logFiles[ucFn].maxNumRollingLogs && existsSync(rollFileName) ) {
					await unlinkFile(rollFileName); // delete the oldest one to make room
				} else {
					if (existsSync(rollFileName)) {
						nuName = rollingLogPath + "/" + fnPath.name + "_" + (""+j).padStart(3,0) + fnPath.ext; 
						try {
							await moveFile(rollFileName, nuName);
						} catch(err) {
							// no-op // TODO, need a better plan
						}
					}
				}
			}
			nuName = rollingLogPath + "/" + fnPath.name + "_" + (""+1).padStart(3,0) + fnPath.ext; // most recent log file 
			try {
				if (existsSync(tmpName)) await moveFile(tmpName, nuName);
			} catch(err) {
				//no-op // TODO, need a better plan
			}
			if (ws === null) { // if it was null in beginning, a new stream needs to be created here.
				this.rollNewStream(fn);
			}
		} catch(err) {
			throw("Error in rollFiles: ", err);
		}
	}

	touch(fn) { // creates a file if it didn't already exist
		if (!existsSync(fn)) {
			closeSync(openSync(fn, "w")); 
		}		
	}
	
	// Recursive, since we may need some extra time for the old stream to clean-up
	// after it closes the logfile, so may need a couple of retries.
	rollNewStream(fn, retryNum=0) {
		if (existsSync(fn)) {
			this.getRegisteredStream(fn, true); // will replace ws in registeredStreams object
			this.emptyLocalQueue(this.getUcFn(fn));
			return;			
		}
		else {
			try {
				const fd = openSync(fn, "w"); // make sure file exists
				closeSync(fd);
			} catch(err) {
				if (retryNum >= 20) throw(err);
			}
			// will recurse now after a setTimeout			
			setTimeout(() => {
				this.rollNewStream(fn, ++retryNum);
			}, 200);		
		}		
	}	
	
	// Make sure the file exists already, or the lazy stream's file create process may not beat other dependencies (esp. watcher)	
	logFileInit(fn, ucFn) {		
		try {
			// get current file information
			const fileStat = statSync(fn);
			const startSizeBytes = fileStat.size;
			const birthTimeMs = fileStat.birthtimeMs;
			if (!logFiles[ucFn]) {
				logFiles[ucFn] = new LogFileRec();
			}
			logFiles[ucFn].fn = fn;
			logFiles[ucFn].startSizeKb = startSizeBytes / 1024;
			logFiles[ucFn].birthTimeMs = birthTimeMs;
		} catch(err) {
			throw("logFileInit error: ", err);
		}		
	}
	
	emptyLocalQueue(ucFn) {
		const ws = registeredStreams[ucFn].ws;
		try {
			while (logFiles[ucFn].localQueue.length > 0) {
				ws.write(logFiles[ucFn].localQueue.shift(), "utf8");
			}
		} catch(err) {
			throw("Error emptying local buffer", err);
		}
		logFiles[ucFn].isQueuing = false;
	}
	
	createCustomWriter(fn) { // Create and init the fs writeStream for this logfile
		let ws;
		let watcher;
		let ucFn = this.getUcFn(fn);
		let isQ = logFiles[ucFn].isQueuing;
		let isR = logFiles[ucFn].isRolling;
		this.logFileInit(fn, ucFn);	
		logFiles[ucFn].isQueuing = isQ; 
		logFiles[ucFn].isRolling = isR;	
		try {
			ws = createWriteStream(fn, {flags: "a", autoclose: true, emitClose: true});
			ws.on("error", (err) => {
				console.error("WritePool log writer stream error :", err); // Attempt to put unexpected error on console, try to keep running...
			});			
			ws.on("open", (fd) => {
				this.updateRecord(fn, {fd: fd} ); // save the file descriptor
			});
			ws.on("close", () => {	
				if (logFiles[ucFn].isInRecovery) {
					this.getRegisteredStream(fn, true); // replace fn's writeStream with new one, opening new file
					logFiles[ucFn].isInRecovery = false;
					this.emptyLocalQueue(ucFn);
				}
				else if (logFiles[ucFn].isRolling) {
					this.rollNewStream(fn);				
				}
			});
			ws.on("ready", () => {
				logFiles[ucFn].isRolling = false;				
			});	
			
			ws.write("New logging Stream for file " + fn + " created in GwLogger.WritePool at " + new Date() + "\n");	
			try {
				// An errant process (or user) can rename/move/remove a logfile. Here, we attempt to detect and re-create it on the fly.
				// This only works on local logfiles, if the logfile is elsewhere on LAN then watcher doesn't seem to work,
				// but if rolling logs are turned on, a new logfile would be created on next roll file.
				watcher = watch(fn, {persistent: false}, () => {
					let exists = existsSync(fn);
					ucFn = this.getUcFn(fn);
					if (!exists && !logFiles[ucFn].isRolling && !logFiles[ucFn].isInRecovery) { // don't use this if currently rolling the logfile					
						logFiles[ucFn].isInRecovery = true; 
						ws.end();
						logFiles[ucFn].isQueuing = true;
					}
				});				
			}
			catch(err) {
				console.log("Error defining GwLogger.writePool's logfile watcher: ", err);
				// no-op
			}
			/*
			if (watcher) {
				watcher.unref(); // don't hold up GwLogger program exit if a watched event fires
				this.updateRecord(fn, { // put watcher somewhere, so it isn't GC'ed
					watcher: watcher 
				});
			}
			*/
			return ws;
		} catch(err) {
			console.error("ERROR, In GwLogger's WritePool.createCustomWriter: ", err);
		}
	}
	
	// Will return a previously registered stream for filename, or have a new one created
	getStream(fn, replace=false, isRollBySize=false, maxLogSizeKb=0, maxNumRollingLogs=0, rollingLogPath=null) {
		let ucFn = this.getUcFn(fn);
		if (registeredStreams && registeredStreams[ucFn] && registeredStreams[ucFn].ws) {
			return this.getRegisteredStream(fn, replace); // return already existing stream immediately
		}
		if (!registeredStreams || !registeredStreams[ucFn]) {
			this.touch(fn); // make sure the file exists
			this.logFileInit(fn, ucFn); // startup, setup registry for this logfile
			// These values are from JSON profile, env vars, and/or built-in defaults
			this.setMaxLogSizeKb(ucFn, maxLogSizeKb);
			this.setMaxNumRollingLogs(ucFn, maxNumRollingLogs);
			this.setRollingLogPath(ucFn, rollingLogPath);			
			this.setIsRollBySize(ucFn, isRollBySize); // must go last, after othr roll-by-size settings			
		}
		if (isRollBySize && this.getNeedToRollSize(null, ucFn)) { // stream doesn't exist yet, but file might, see if it needs rolled
			logFiles[ucFn].isRolling = true;
			logFiles[ucFn].isQueuing = true;		
			return this.rollFiles(ucFn); // perform rolling of logfiles
		} else {
			return this.getRegisteredStream(fn, replace);
		}
	}
	
	writeToBuffer(ucFn, txt) {
		logFiles[ucFn].localQueue.push(txt);
	}
	
	// Writes to the logfile's stream or localQueue
	write(ucFn, txt) {
		let bufferOk = false;	
		if (logFiles[ucFn].isQueuing) { // write to array buffer until new file/writestream created during rolling of files
			this.writeToBuffer(ucFn, txt);
			return bufferOk; // 'false' will apply artificial backpressure, if user's app is listening
		}
		try {
			const ws = registeredStreams[ucFn].ws;			
			bufferOk = ws.write(txt, "utf8"); // returns stream buffer's backpressure status (false if buffer size is over high-water mark)
			// see if time to check for rolling the log, and set that in motion
			if (this.checked > this.CHECK_FREQUENCY) {
				this.checked = 0;
				this.checkRollingFiles();
			}
			this.checked++;
			return bufferOk;
		} catch(err) {
			throw("ERROR in GwLogger.WritePool.write: ", err);
		}
	}

}



const writePool = new WritePool();

module.exports = writePool;

