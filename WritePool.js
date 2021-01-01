"use strict";
/**
 * WritePool manages pools of streams and logfiles, and rolls
 * logfiles when/if specified.
 *
 * It helps ensure that any of the user's instances of GwLogger that log to the 
 * same logfile will write to the same writeStream rather than creating 
 * another one on a different buffer. It handles a lot of details.
 * 
*/
// exceptions to ESLint no-init rule
/*global module, console, setTimeout, clearTimeout, require */

const createWriteStream = require("fs").createWriteStream;
const watch = require("fs").watch;
const existsSync = require("fs").existsSync;
const path = require("path");
const statSync = require("fs").statSync;
const closeSync = require("fs").closeSync;
const openSync = require("fs").openSync;

const moveFileZip = require("./fsprom.js").moveFileZip;
const moveFile = require("./fsprom.js").moveFile;
const unlinkFile = require("./fsprom.js").unlinkFile;
const accessFile = require("./fsprom.js").accessFile;
const fs = require("fs");

const getTimeStamp = require("./timestamps.js").getTimeStamp;

const version = "1.5.1";

/*
Most buffering occurs inside the stream object, as usual for writestreams. 
But during a roll event, a localQueue, defined below, takes over. Buffering 
to the localQueue usually only happens for a short period while waiting for 
the outgoing file to receive remainder of any buffer still held by an 
ended writestream. After which, a new writestream is created and takes over.
*/

let writeStreams = {}; // contains fs.writeStream(s) and properties
let logFiles = {}; // contains LogFileRecs
let loggers = {}; // contains GwLogger instance registry (ID, ucFn, EventEmitter)
let loggerCount = 0;

// Holds properties and state information for a logfile
class LogFileRec {
	constructor (isRollBySize = false, rollingLogPath = null
		, maxNumRollingLogs = 0, maxLogSizeKb = 0
		, isRollAsArchive = false, archiveLogPath = null) {
		this.isRollBySize = isRollBySize; // Turns on rolling-by-size feature.
		this.rollingLogPath = rollingLogPath;
		this.maxNumRollingLogs = maxNumRollingLogs;
		this.maxLogSizeKb = maxLogSizeKb;
		this.isRollAsArchive = isRollAsArchive;
		this.archiveLogPath = archiveLogPath;
		this.oldBufferOk = true;
		this.isRolling = false; // currently in the rolling process
		
		this.isQueuing = false; // directs logging for this file to the localQueue
		this.localQueue = []; // The internal queue for this logfile
		
		this.loggerIds = []; // IDs of loggers using this logfile.
		
		this.startSizeKb = 0; // The size, in KB, of the logfile at startup
		this.birthTimeMs = null; // Timestamp for logfile's creation date/time.

		// If a log file is accidentally removed/renamed, a recovery process 
		//tries to re-create
		this.isInRecovery = false;
	}
}

// The main class that does all the work managing files and streams.
class WritePool {
	constructor () {
		// After every nth write attempt will see if file needs rolled for size		
		this.CHECK_FREQUENCY = 20;
		this.checked = 0; // A counter adjusted after each write attempt.
	}

	getVersion() {
		return version;
	}
	
	isLogFile(ucFn) {
		if (logFiles && logFiles[ucFn]) return true;
		else return false;
	}
	
	getLoggerId(eventEmitter) { // return a random-but-unique logger ID
		if (!eventEmitter) return null; // ee is required
		loggerCount++;
		let loggerId = "gwl"+loggerCount;
		loggers[loggerId] = {eventEmitter: eventEmitter, ucFn: null};
		return loggerId;
	}
	
	// ucFn is "upper-case file name" without any whitespace, and is
	// used as a key for logfile records and streams.
	getUcFn(fn) { 
		if (!fn) return null;
		fn = path.resolve(fn);
		return fn.replace(/\s+/g, "").toUpperCase();
	}
	
	//		methods for roll as Archive
	
	setIsRollAsArchive(ucFn, b) {
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].isRollAsArchive = b;
		return b;
	}	
	getIsRollAsArchive(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].isRollAsArchive 
			: null;
	}
	
	//		methods for roll at startup
	
	setIsRollAtStartup(ucFn, b) { 
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].isRollAtStartup = b;
		return b;
	}	
	getIsRollAtStartup(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].isRollAtStartup 
			: null;
	}
		
	// 		methods for roll by size settings
	
	setIsRollBySize(ucFn, b) {
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].isRollBySize = b;
		return b;
	}	
	getIsRollBySize(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].isRollBySize 
			: null;
	}
	
	setMaxLogSizeKb(ucFn, kb) { // approx max for each logfile
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].maxLogSizeKb = kb;
		return kb;
	}
	getMaxLogSizeKb(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].maxLogSizeKb 
			: null;
	}

	setMaxNumRollingLogs(ucFn, n) { // how many logfiles to keep
		if (!this.isLogFile(ucFn)) return null;
			logFiles[ucFn].maxNumRollingLogs = n;
			return n;
		}	
	getMaxNumRollingLogs(ucFn) {
		return (this.isLogFile(ucFn)) 
			? logFiles[ucFn].maxNumRollingLogs 
			: null;
	}

	// set the path to store old logfiles. Must be cleaned first by Profiles.
	setRollingLogPath(ucFn, rollPath) { 
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].rollingLogPath = rollPath;
		return true;
	}	
	getRollingLogPath(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].rollingLogPath 
			: null;
	}
	
	setArchiveLogPath(ucFn, archiveRollPath) { 
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].archiveLogPath = archiveRollPath;
		return true;
	}	
	getArchiveLogPath(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].archiveRollPath 
			: null;
	}
	
	getCurrentFileSizeKb(ucFn) {
		const fn = logFiles[ucFn].fn;
		const fileStat = statSync(fn);
		return fileStat.size / 1024;
	}
	
	// Determines the size of the writeStream's buffer
	getWritableLengthKb(ucFn) {
		if (!writeStreams || !writeStreams[ucFn] 
			|| !writeStreams[ucFn].ws) return null;
		let ws = writeStreams[ucFn].ws;
		return Math.trunc(ws.writableLength/1024);
	}
	
	// test instrumentation
	getIsQueuing(ucFn) { 
		if (!this.isLogFile(ucFn) || logFiles[ucFn].isQueuing === undefined
			|| logFiles[ucFn].isQueuing === null) {
				return false;
			}
		return logFiles[ucFn].isQueuing;
	}
	
	// test instrumentation
	getLocalQueueLength(ucFn) { 
		if (!this.isLogFile(ucFn)) return null;
		return logFiles[ucFn].localQueue.length;
	}
	
	// test instrumentation
	getIsRolling(ucFn) {
		if (!this.isLogFile(ucFn) || logFiles[ucFn].isRolling === undefined
			|| logFiles[ucFn].isRolling === null) {
				return false;
			}
		return logFiles[ucFn].isRolling;
	}	
	
	// test instrumentation
	getWsStream(ucFn) {
		let record = writeStreams[ucFn];
		if (record && record.ws) {
			return record.ws;
		} else {
			return null; // no ws at this time
		}		
	}
	
	// Will add the items in nuBits to the writeStreams record
	updateRecord(ucFn, nuBits) {
		let record;
		record = writeStreams[ucFn];	
		if (!record) return null;
		record = Object.assign({}, record, nuBits);
		writeStreams[ucFn] = record;
		return record;		
	}
	
	// Returns a stream for a given logfile. 
	// May have to create it, or replace existing ws
	getRegisteredStream(fn, replace=false) {
		let ws;
		let record;
		let ucFn = this.getUcFn(fn);
		record = writeStreams[ucFn];
		if (record && record.ws && !replace) {
			return ws;
		}
		if (replace && record && record.watcher) {
			record.watcher = null; // GC the old watcher, closed or not closed.
		}	
		if (replace && record && record.fd) {
			record.fd = null;
		}
		writeStreams[ucFn] = {}; // clean slate for this file record
		writeStreams[ucFn].ready = false;
		// Make sure the file exists already, or the stream's lazy file create process
		// may not beat other dependencies (esp. watcher)		
		this.touch(fn);
		ws = this.createCustomWriter(fn); // create a new stream
		writeStreams[ucFn].ws = ws;
		return ws;		
	}
	
	// Check if logfile size estimate is larger than target max set by user
	// ws is writeStream, ucFn is upper-case-filename
	getNeedToRollSize(ws, ucFn) {
		let currentSize = 0;
		if (logFiles[ucFn] && logFiles[ucFn].isRolling) {
			return false; // already rolling...
		}
		// ws may be undefined at startup, so ws buffer regarded as empty; 
		if (ucFn && !ws) { 
			if (logFiles[ucFn].startSizeKb  > logFiles[ucFn].maxLogSizeKb) {
				return true;
			}	
			else return false; 
		}
		if (logFiles[ucFn].truncate) { // Must use only current file size
			currentSize = this.getCurrentFileSizeKb(ucFn);
		} else {
			currentSize = logFiles[ucFn].startSizeKb + ws.bytesWritten/1024
				+ Math.trunc(ws.writableLength/1024);
		}
		if (currentSize > logFiles[ucFn].maxLogSizeKb) {
			return true;
		} else {
			return false;
		}
	}	
	
	checkRollingFile(ucFn) {
		let ws;
		if (logFiles[ucFn]
				&& logFiles[ucFn].isRollBySize 
				&& !logFiles[ucFn].isRolling 
				&& !logFiles[ucFn].isInRecovery 
				&& logFiles[ucFn].maxLogSizeKb > 0 
				&& (logFiles[ucFn].maxNumRollingLogs > 0
					|| logFiles[ucFn].isRollAsArchive) ) {
			ws = (writeStreams[ucFn]) 
				? writeStreams[ucFn].ws 
				: null;
			if (ws && !writeStreams[ucFn].ready) {
				return; // don't interrupt stream creation, rolling can wait.
			}
			if (this.getNeedToRollSize(ws, ucFn)) {
				this.preRollFiles(ucFn);
			}
		} else if (logFiles[ucFn] && logFiles[ucFn].isQueuing) {
			// Corner-case if rolling was turned off due to an previous error, still need 
			//  to empty queue of any data and resume normal logging.
			this.emptyLocalQueue(ucFn);
		}		
	}
	// Check to see if it is time to roll	
	checkRollingFiles() { 
		for (let ucFn in logFiles) {
			this.checkRollingFile(ucFn);
		}
	}
	
	// The mostly-synchronous prelude to async rollFiles
	preRollFiles(ucFn) {
		if (logFiles[ucFn].isRolling) {
			return;
		}
		logFiles[ucFn].isRolling = true;
		logFiles[ucFn].isQueuing = true;
		const fn = logFiles[ucFn].fn;		
		const ws = (writeStreams[ucFn] && writeStreams[ucFn].ws) 
			? writeStreams[ucFn].ws 
			: null;	
		// timer will keep app alive if rolling incomplete when app ends normally
		const timer = setTimeout(() => {
			console.error("Timer in GwLogger - preRollFiles expired after 1 hour.");
		}, 360000);			
		const p = new Promise( (resolve) => {
			let needNewStream = this.rollFiles(ucFn, ws, fn);
			resolve(needNewStream);
			clearTimeout(timer);			
		});
		p.then((needNewStream) => {
			if (needNewStream || ws === null) {
				this.rollNewStream(fn);
			} 
		});
		p.catch((err) => {
			this.send(ucFn, "warn", 3010, msg.errUknown(fn), err);
		});
	}
	
	// Determine timestamp and generate a file name for an archive
	// The name could include a timestamp from the file metadata (last modified 
	// time).
	//
	// useFileTS means to try and derive timestamp from file's last modified
	// date, otherwise will use current time (former for fresh logfile, latter
	// for a rolled file, which could have been on drive a long time.
	async createArchiveName(oldFname, path, fnPath, useFileTS) {
		const timeStampFormat = {isShowMs: false, nYr: 4, sephhmmss: ""};
		const currentTimeMs = Date.now();
		let ms;
		if (useFileTS) {
			const stats = fs.statSync(oldFname);
			ms = stats.mtimeMs; // last time file was modified
			const oneYearMs = 31536000000;
			// If a machine or network drive isn't setting times correctly
			// on the file system, then use current time in file name.
			if ((currentTimeMs - ms) > oneYearMs) ms = currentTimeMs;
		}
		let ts = getTimeStamp(timeStampFormat, ms);
		if (!path) path = fnPath.dir; // use logfile path
		let nuFname = path + "/" + fnPath.name + "_" 
			+ ts + fnPath.ext + ".gz"; // use time from file record
		if (existsSync(nuFname)) { // naming conflict, likely NAS drive problem
			ts = getTimeStamp(timeStampFormat, currentTimeMs+1);
			nuFname = path + "/" + fnPath.name + "_" 
				+ ts + fnPath.ext + ".gz";	 // use current time + 1ms	
		}		
		return nuFname;
	}
	
	// Sends events to listeners. detailObj is stacktrace or details for msg type
	send(ucFn, typeMsg, msgCode, msgText, detailObj=null) {
		try {
			for (let loggerId of logFiles[ucFn].loggerIds) {
				loggers[loggerId].eventEmitter.emit(typeMsg, msgCode, msgText, detailObj);
			}
		} catch(err) {
			if (typeMsg === "error") { // will throw an error
				throw {msgCode: msgCode, msgText: msgText, causedBy: err};
			}
		}		
	}
	
	// Perform logfile roll
	async rollFiles(ucFn, ws, fn) {	
		const fnPath = path.parse(fn);	
		const maxNum = logFiles[ucFn].maxNumRollingLogs;
		let nuFname = "";
		let rollingLogPath = logFiles[ucFn].rollingLogPath;
		if (!rollingLogPath) rollingLogPath = fnPath.dir; // logfile directory!
		const isArchive = logFiles[ucFn].isRollAsArchive;
		let archiveLogPath = logFiles[ucFn].archiveLogPath;
		if (!archiveLogPath) archiveLogPath = rollingLogPath;		
		let typeOfMove;
		// Make sure logfile exists (it IS possible to delete a logfile)
		if (!existsSync(fn)) {
			if (ws) ws.end(); // stop the stream's buffer from attempting to write to deleted file				
			return false;
		}
		if (maxNum > 0) {
			nuFname = rollingLogPath + "/" + fnPath.name + "_" 
				+ (""+1).padStart(3,0) + fnPath.ext; // to be most recently rolled				
			await this.rollLogtrain(ucFn, fnPath, rollingLogPath
						, isArchive, archiveLogPath);	
		} else if (isArchive) {
			nuFname = await this.createArchiveName(fnPath.name
				, archiveLogPath, fnPath, false);
		}			
		// roll current logfile
		try {
			if (ws) ws.cork(); // stop the stream's buffer from attempting to write to file				
			typeOfMove = await this.rollLogfile(fn, nuFname, ucFn
				, ws, isArchive);
		} catch(err) {
			// An unanticipated error, likely in moveFile			
			// Try to recover without bringing down the application,
			// make sure there is a logfile at very least
			if (!existsSync(fn)) {
				if (ws) ws.end(); // kill the old stream				
				return false;
			}			
			this.haltAllRolling(ucFn); // turn off rolling for logfile 						
			if (ws) ws.end();
			this.send(ucFn, "warn", 3242, msg.warNoRoll01(fn), err);
			return false; 
		}		
		if (typeOfMove === "trunc") {
			logFiles[ucFn].isRolling = false;
		}
		return false;
	}

	async rollLogtrain(ucFn, fnPath, rollingLogPath, isArchive, archiveLogPath) {
		let oldFname, nuFname;
		const maxNum = logFiles[ucFn].maxNumRollingLogs;
		for (let oldFnum = maxNum; oldFnum > 0; oldFnum--) {
			let nuFnum = oldFnum + 1;
			oldFname = rollingLogPath + "/" + fnPath.name 
				+ "_" + (""+oldFnum).padStart(3,0) + fnPath.ext; 
			if (oldFnum === maxNum 
					&& await accessFile(oldFname) ) {
				if (isArchive) {
					let nuFname = await this.createArchiveName(oldFname
						, archiveLogPath, fnPath, true);
					try {
						await moveFileZip(oldFname, nuFname, true);
					} catch(err) {
						this.haltAllRolling(ucFn);
						this.send(ucFn, "warn", 3240, msg.warRollOld01(oldFname), err);
					}
				}
				else {
					await unlinkFile(oldFname); // delete the oldest one
					}
			} else {
				if (oldFnum < maxNum
					&& await accessFile(oldFname) ) {
					nuFname = rollingLogPath + "/" + fnPath.name + "_" 
						+ (""+nuFnum).padStart(3,0) + fnPath.ext; 
					try {
						await moveFile(oldFname, nuFname);
					} catch(err) {
						this.haltAllRolling(ucFn);
						this.send(ucFn, "warn", 3241, msg.warRollOld01(oldFname), err);
					}
				}
			}
		}
	}
	
	async rollLogfile(fn, nuFname, ucFn, ws, isArchive) {
		let typeOfMove;
		typeOfMove = (isArchive && logFiles[ucFn].maxNumRollingLogs === 0)
			? await moveFileZip(fn, nuFname, true)
			: await moveFile(fn, nuFname, true);
		if (!typeOfMove || typeOfMove === "none") { 
			throw("typeOfMoveIsNone"); // caught by caller (rollFiles) method
		} else if (typeOfMove === "trunc") { // truncated fn
			logFiles[ucFn].truncate = true;
			logFiles[ucFn].startSizeKb = 0;
			logFiles[ucFn].birthTimeMs = Date.now();					
			if (ws) {
				ws.uncork();
				this.emptyLocalQueue(ucFn);
			}	
		} else { // typeOfMove === "renamed"
			logFiles[ucFn].truncate = false;
			if (writeStreams[ucFn] && writeStreams[ucFn].watcher) {
				writeStreams[ucFn].watcher.close();
			}
			// An existing stream will continue writing in the nuFname 
			// location (inode) until stream-buffer empty and stream ends/closes.
			if (ws) ws.end(); // will uncork, end stream, and close file
		}
		return typeOfMove;		
	}
	
	touch(fn) { // creates a file if it didn't already exist
		if (!existsSync(fn)) {
			closeSync(openSync(fn, "w")); 
			return false; // file did not previously exist
		} else {
			return true; // file did already exist
		}
	}
	
	// Recursive, since we may need some extra time for the old stream to clean-up
	// after it closed the logfile and continue, so may need a couple of retries.
	rollNewStream(fn, retryNum=0) {
		const ucFn = this.getUcFn(fn);
		// will wait for new logfile to be created before creating stream
		if (existsSync(fn)) {
			this.getRegisteredStream(fn, true); // replace ws in writeStreams obj
			this.emptyLocalQueue(ucFn);
			return;			
		}
		else {
			try {
				const fd = openSync(fn, "w"); // make sure file exists
				closeSync(fd);
			} catch(err) {
				if (retryNum >= 30) {
					// cannot open file, stop rolling for all loggers.
					//  send msg to GwLogger to stop file logging for this logger
					//  leave queue intact, leave other instances of GwLogger still logging.
					//  Allows user's app to turn on again if wants to try again
					this.send(ucFn, "GwLoggerSystemMsgx42021", 3223, msg.errNotOpen(fn), err); // signal GwLogger
					this.send(ucFn, "warn", 3223, msg.errNotOpen(fn), err); // signal user's app
					this.haltAllRolling(ucFn);
					return; // give up, turn off logging to file
				}
			}
			// will recurse now after a setTimeout			
			setTimeout(() => {
				this.rollNewStream(fn, ++retryNum);
			}, 200);		
		}		
	}
		
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
			this.send(ucFn, "error", 3009, msg.errLfInit01(fn), err);
		}		
	}
	
	emptyLocalQueue(ucFn) {
		if (!writeStreams[ucFn] || !writeStreams[ucFn].ws) return;
		const ws = writeStreams[ucFn].ws;
		try {
			while (logFiles[ucFn].localQueue.length > 0) {
				ws.write(logFiles[ucFn].localQueue.shift(), "utf8");
			}
		} catch(err) {
			this.send(ucFn, "GwLoggerSystemMsgx42021", 3222, msg.warQ01(logFiles[ucFn].localQueue.length
				, logFiles[ucFn].fn), err); // for affect
			this.haltAllRolling(ucFn);
			this.send(ucFn, "warn", 3222, msg.warQ01(logFiles[ucFn].localQueue.length
				, logFiles[ucFn].fn), err);
			return; // queue left intact in case user fixes issue with file and setIsFile(true) again.
		}
		logFiles[ucFn].isQueuing = false;
	}
	
	// Create and init the fs writeStream for logfile fn
	createCustomWriter(fn) {
		let ws;
		let watcher;
		let ucFn = this.getUcFn(fn);
		let isQ = logFiles[ucFn].isQueuing;
		let isR = logFiles[ucFn].isRolling;
		const loggerIds = logFiles[ucFn].loggerIds;
		let localQueue = logFiles[ucFn].localQueue;
		// Make sure the file record is reset/initialized, but persist some items
		this.logFileInit(fn, ucFn);	
		logFiles[ucFn].isQueuing = isQ; 
		logFiles[ucFn].isRolling = isR;	
		logFiles[ucFn].loggerIds = loggerIds;
		logFiles[ucFn].localQueue = localQueue;
		try {
			// note on using flags: "a+" does not work on Linux or MAC...
			ws = createWriteStream(fn
				, {flags: "a", autoclose: false, emitClose: true});
			ws.on("error", (err) => {
				// If the fd was previously closed by the finish event handler,
				// the ws's close event will throw an error when it tries to 
				// close the fd, so will ignore those errors here but catch others.
				if (!ucFn || !writeStreams[ucFn] || writeStreams[ucFn].fd 
					|| err.code !== "EBADF" || err.syscall !== "close") {
					if (ucFn) this.send(ucFn, "error", 3010, msg.errUknown(fn), err);	
						else throw err;
				} 
			});
			ws.on("drain", () => {
			let buffsizeKb = (writeStreams[ucFn] && writeStreams[ucFn].ws) 
				? Math.trunc(ws.writableLength/1024)
				: 0;
				this.send(ucFn, "buffer", 3101, msg.infoDrained(fn)
, 					{buffsizeKb: buffsizeKb, queueLen: logFiles[ucFn].localQueue.length
						, fn: logFiles[ucFn].fn});					
			});

			ws.on("open", (fd) => {
				this.updateRecord(ucFn, {fd: fd} ); // save the file descriptor
				writeStreams[ucFn].ready = true; // node ver<9 lacks "ready" event
				logFiles[ucFn].isRolling = false; // node ver<9 lacks "ready" event
			});
			ws.on("close", () => {
				if (logFiles[ucFn].isInRecovery) {
					// replace fn's writeStream with new one, opening new file
					this.getRegisteredStream(fn, true); 
					logFiles[ucFn].isInRecovery = false;
					this.emptyLocalQueue(ucFn);
				}
				else if (logFiles[ucFn].isRolling) {
					this.rollNewStream(fn);				
				}
			});
			ws.on("ready", () => {			
			});	
			
			ws.write("New logging Stream for file " + fn 
				+ " created in GwLogger.WritePool at " + new Date() + "\n");
				
			try {
				// An errant process (or user) can rename/move/remove a logfile. 
				// Here, we attempt to detect and re-create it on the fly.
				// This only works on local logfiles, if the logfile is elsewhere 
				// on LAN then watcher doesn't seem to work,
				// but if rolling logs are turned on, a new logfile would be 
				// created on next roll file.
				// The watch method returns an fs.FSWatcher object.
				watcher = watch(fn, {persistent: false}, () => {
					let exists = existsSync(fn);
					ucFn = this.getUcFn(fn);
					if (!exists && !logFiles[ucFn].isRolling 
						&& !logFiles[ucFn].isInRecovery) { 					
						logFiles[ucFn].isInRecovery = true; 
						logFiles[ucFn].isQueuing = true;						
						if (ws) ws.end();
						this.send(ucFn, "warn", 3003, msg.warWat03(fn));
					}
				});	
				watcher.on("error",	(err) => {
					this.send(ucFn, "warn", 3005, msg.warWat01(fn), err);
				});			
			}
			catch(err) {
				// A warning, will continue
				this.send(ucFn, "warn", 3004, msg.warWat02(fn), err);				
			}

			if (watcher) {
				this.updateRecord(ucFn, { // save reference to watcher
					watcher: watcher 
				});
			}
			return ws;
		} catch(err) {
			this.send(ucFn, "GwLoggerSystemMsgx42021", 3221, msg.warWpCw01(fn), err); // for affect
			this.haltAllRolling(ucFn);
			this.send(ucFn, "warn", 3221, msg.warWpCw01(fn), err); // for user info
		}
	}
	
	haltAllRolling(ucFn) {
		// quit trying to roll for any logger using this file
		if (this.isLogFile[ucFn]) {
			logFiles[ucFn].isRollBySize = false;					
			logFiles[ucFn].isRollAtStartup = false;
			logFiles[ucFn].isRollAsArchive = false;	
		}		
	}
	
	// Will return an existing stream for logfile, or have a new one created
	getStream(fn, replace=false, activeProfile) {
		let ucFn = this.getUcFn(fn);
		let fnExisted;
		let loggerId = activeProfile.loggerId;
		if (!loggers[loggerId].ucFn) {
				loggers[loggerId].ucFn = ucFn;
		}			
		if (writeStreams && writeStreams[ucFn] && writeStreams[ucFn].ws) {
			return this.getRegisteredStream(fn, replace);
		}
		if (!writeStreams || !writeStreams[ucFn]) {
			fnExisted = this.touch(fn); // make sure the file exists
			this.logFileInit(fn, ucFn); // startup, setup registry for logfile
			// add the logger's eventEmitter to the logfile's info
			if (!logFiles[ucFn].loggerIds.indexOf(loggerId) > -1) {
				logFiles[ucFn].loggerIds.push(loggerId);
			}
			this.setIsRollAsArchive(ucFn, activeProfile.isRollAsArchive);
			this.setArchiveLogPath(ucFn, activeProfile.archiveLogPath);
			this.setIsRollAtStartup(ucFn, activeProfile.isRollAtStartup);
			this.setMaxLogSizeKb(ucFn, activeProfile.maxLogSizeKb);
			this.setMaxNumRollingLogs(ucFn, activeProfile.maxNumRollingLogs);
			this.setRollingLogPath(ucFn, activeProfile.rollingLogPath);			
			this.setIsRollBySize(ucFn, activeProfile.isRollBySize);
		}
		if (fnExisted && activeProfile.isRollAtStartup
				&& activeProfile.rollingLogPath 
				&& (activeProfile.maxNumRollingLogs > 0
					|| activeProfile.isRollAsArchive) ) {
			this.preRollFiles(ucFn); // perform rolling of logfiles
			return;
		}
		// stream may not exist yet, but large file might, see if it needs rolled		
		else if (activeProfile.isRollBySize) {
			// perform rolling of logfiles and create a new stream
			this.checkRollingFile(ucFn);
			if (!logFiles[ucFn].isRolling) {
				return this.getRegisteredStream(fn, replace);
			} else return;
		} 
		else {
			return this.getRegisteredStream(fn, replace);
		}
	}
	
	writeToQueue(ucFn, txt) {
		let qLen = logFiles[ucFn].localQueue.length;
		if (qLen > 1 && qLen % 300 === 0 ) {
			let buffsizeKb = (writeStreams[ucFn] && writeStreams[ucFn].ws) 
				? Math.trunc(writeStreams[ucFn].ws.writableLength/1024)
				: 0;
			this.send(ucFn, "buffer", 3103
				, msg.infoQueueSize(logFiles[ucFn].localQueue.length
					, logFiles[ucFn].fn)
					, {buffsizeKb: buffsizeKb, queueLen: logFiles[ucFn].localQueue.length
						, fn: logFiles[ucFn].fn});			
		}
		logFiles[ucFn].localQueue.push(txt);
	}
	
	// Writes to the logfile's stream or localQueue
	write(loggerId, ucFn, txt) {
		try {		
			let bufferOk = false;
			if (logFiles[ucFn].isQueuing) { 
				// write to array buffer until new file/writestream created		
				this.writeToQueue(ucFn, txt);
				return bufferOk; // 'false' will apply artificial backpressure
			}
			const ws = writeStreams[ucFn].ws;
			// bufferOk will hold the stream buffer's backpressure status 
			// (will be false if buffer size is over high-water mark)
			bufferOk = ws.write(txt, "utf8"); 
			// see if time to check for rolling the log, and set that in motion
			if (this.checked > this.CHECK_FREQUENCY) {
				this.checked = 0;				
				this.checkRollingFiles();
			}
			this.checked++;
			if (!bufferOk && this.oldBufferOk) { // transistion to > 16K in buffer
				let buffsizeKb = (writeStreams[ucFn] && writeStreams[ucFn].ws) 
					? Math.trunc(ws.writableLength/1024)
					: 0;				
				this.send(ucFn, "buffer", 3102, msg.infoBuffSize(buffsizeKb
					, logFiles[ucFn].localQueue.length, logFiles[ucFn].fn)
					, {buffsizeKb: buffsizeKb, queueLen: logFiles[ucFn].localQueue.length
						, fn: logFiles[ucFn].fn});					
			}
			this.oldBufferOk = bufferOk;			
			return bufferOk;
		} catch(err) {
			this.haltAllRolling(ucFn);
			const fn = (logFiles && logFiles[ucFn]) 
				? logFiles[ucFn].fn 
				: msg.unknown;
				this.send(ucFn, "GwLoggerSystemMsgx42021", 3224, msg.warWpCw01(fn), err); // for affect				
				this.send(ucFn, "warn", 3224, msg.errWpw01(fn), err); // for user info
		}
	}
}

const msg = {
	warRollOld01: (s1) => {return `WARN: Cannot roll files, will turn off rolling logfiles for ${s1}\n`;},
	errLfInit01: (s1) => {return `ERROR: Failed to initialize logfile: ${s1} \n`;},
	errWpw01: (s1) => {return `WARN: Error while logging, will give up logging to the file: ${s1}\n`;},
	warNoRoll01: (s1) => {return `WARN: Error moving logfile: ${s1} – turning off rolling.\n`;},
	warWat01: (s1) => {return `WARN: A watcher error event occurred while watching the logfile: ${s1}\n`;},
	warWat02: (s1) => {return `WARN: Unable to define watcher for: ${s1}\n`;},
	warWat03: (s1) => {return `WARN: Detected logfile deletion by external process or user, will attempt to create a new one. Logfile: ${s1}\n`;},
	warWpCw01: (s1) => {return `WARN: Failed to create writeStream for file: ${s1}, will stop logging to this file.\n`;},
	errNotOpen: (s1) => {return `ERROR: Cannot open file: ${s1}, and will stop logging to that file\n`;},	
	unknown: "unknown",
	warQ01: (s1, s2) => {return `WARN: Error writing queue to stream, length is: ${s1}, file is: ${s2}; will stop logging to this file.\n`;},
	infoDrained: (s1) => {return `BUFFER: The stream buffer is drained for file: ${s1} \n`;},
	infoBuffSize: (s1, s2, s3) => {return `BUFFER: Logfile stream buffer >${s1}K, queue holds additional ${s2} lines for logfile: ${s3}\n`;},
	infoQueueSize: (s1, s2) => {return `BUFFER: Logfile internal queue holds > 300 (${s1}) lines for logfile: ${s2}\n`;},
	errUknown: (s1) => {return `ERROR: Unknown error from the writeStream for logfile ${s1}`;}
};

const writePool = new WritePool();

module.exports = writePool;

