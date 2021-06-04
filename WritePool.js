"use strict";
/** @overview
 * WritePool specializes in logging to logfiles, and 
 * manages pools of streams and logfiles.
 *
 * It helps ensure that any of the user's instances of GwLogger that log to the 
 * same logfile will write to the same writeStream rather than creating 
 * another one on a different buffer. It handles a lot of details.
 * 
 * All functions herein are only used internally. Methods and objects 
 * may change their form, function, or be removed.
*/

// exceptions to ESLint no-init rule
/*global module, setTimeout, require */

const createWriteStream = require("fs").createWriteStream;
const watch = require("fs").watch;
const existsSync = require("fs").existsSync;
const path = require("path");
const statSync = require("fs").statSync;
const closeSync = require("fs").closeSync;
const openSync = require("fs").openSync;
const { FileRec } = require("./FileRec.js");
const accessFile = require("./fsprom.js").accessFile;
const touchFileSync = require("./fsprom.js").touchFileSync;

const version = "1.5.4";

let writeStreams = {}; // contains fs.writeStream(s) and properties
let logFiles = {}; // contains FileRecs
let loggers = {}; // contains GwLogger instance registry (ID, ucFn, EventEmitter)
let loggerCount = 0;

/** 
 * @desc The main WritePool class, a singleton, that does all the work managing 
 * files and file streams. 
 * @class 
 * @private
*/
class WritePool {
	constructor () {
		// After every nth write attempt will see if file needs rolled for size		
		this.CHECK_FREQUENCY = 20;
		this.checked = 0; // A counter adjusted after each write attempt.	
	}

	/** @private
		@desc Test instrumentation.
		@returns {string} Version number. */
	getVersion() {
		return version;
	}
	
	/** @private 
		@returns {boolean} true if ucFn registered in logFiles. */
	isLogFile(ucFn) {
		if (logFiles && logFiles[ucFn]) return true;
		else return false;
	}
	
	/** @private 
	*	@param {object} eventEmitter - instance of EventEmitter.
	*	@returns {string} A unique ID which has been paired to an eventEmitter.
	*/
	getLoggerId(eventEmitter) { // return a unique logger ID
		if (!eventEmitter) return null; // ee is required
		loggerCount++;
		let loggerId = "gwl"+loggerCount;
		loggers[loggerId] = {eventEmitter: eventEmitter, ucFn: null};
		return loggerId;
	}
	
	/**
	 * @private
	 * @param {string} fn - A path and filename to use as logfile.
	 * @returns upper-case file name without any whitespace, and is
	 * used as a key for logfile records and streams.
	*/
	getUcFn(fn) { 
		if (!fn) return null;
		fn = path.resolve(fn);
		return fn.replace(/\s+/g, "").toUpperCase();
	}
	
	//		methods for roll as Archive
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.	
	 * @param {boolean} b - true to roll logfiles to an archive.
	*/
	setIsRollAsArchive(ucFn, b) {
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].isRollAsArchive = b;
		return b;
	}
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {boolean} true to roll logfiles to an archieve, or null.
	*/
	getIsRollAsArchive(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].isRollAsArchive 
			: null;
	}
	
	//		methods for roll at startup
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.	
	 * @param {boolean} b - true to roll logfiles upon first startup.
	*/	
	setIsRollAtStartup(ucFn, b) { 
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].isRollAtStartup = b;
		return b;
	}
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {boolean} true if rolling logfiles at startup, or null.
	*/
	getIsRollAtStartup(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].isRollAtStartup 
			: null;
	}
		
	// 		methods for roll by size settings

	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.	
	 * @param {boolean} b - true to roll logfiles when too large.  
	*/		
	setIsRollBySize(ucFn, b) {
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].isRollBySize = b;
		return b;
	}
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {boolean} true if rolling logfiles due to large size, or null.
	*/	
	getIsRollBySize(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].isRollBySize 
			: null;
	}
	
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @param {number} kb - size in KB to roll files.	
	 * @returns {number} kb - size in KB to roll files, or null.
	*/		
	setMaxLogSizeKb(ucFn, kb) { // approx max for each logfile.
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].maxLogSizeKb = kb;
		return kb;
	}
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {number} kb - size in KB to roll files, or null.
	*/		
	getMaxLogSizeKb(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].maxLogSizeKb 
			: null;
	}

	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @param {number} n - how many logfiles to keep.	
	 * @returns {number} how many logfiles to keep, or null.
	*/	
	setMaxNumRollingLogs(ucFn, n) { 
		if (!this.isLogFile(ucFn)) return null;
			logFiles[ucFn].maxNumRollingLogs = n;
			return n;
		}
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {number} how many logfiles to keep, or null.
	*/	
	getMaxNumRollingLogs(ucFn) {
		return (this.isLogFile(ucFn)) 
			? logFiles[ucFn].maxNumRollingLogs 
			: null;
	}

	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @param {string} rollPath - directory for storing old logfiles. 
	 * @returns {boolean|null} true if successfully stored, null if 
	 * key wasn't found.
	*/		
	setRollingLogPath(ucFn, rollPath) { 
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].rollingLogPath = rollPath;
		return true;
	}
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {string} Directory for storing old logfiles, or null.
	*/	
	getRollingLogPath(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].rollingLogPath 
			: null;
	}

	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @param {string} archiveRollPath - directory for storing compressed logfiles. 
	 * @returns {boolean} , or null
	*/		
	setArchiveLogPath(ucFn, archiveRollPath) { 
		if (!this.isLogFile(ucFn)) return null;
		logFiles[ucFn].archiveLogPath = archiveRollPath;
		return true;
	}
	
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {string} Directory for storing compressed logfiles, or null.
	*/	
	getArchiveLogPath(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].archiveRollPath 
			: null;
	}
	
	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {number} Size, in KB, of logfile on disk.
	*/	
	getCurrentFileSizeKb(ucFn) {
		const fn = logFiles[ucFn].fn;
		const fileStat = statSync(fn);
		return fileStat.size / 1024;
	}

	/**
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {number} Size of the logfile's stream buffer, or null.
	*/	
	getWritableLengthKb(ucFn) {
		if (!writeStreams || !writeStreams[ucFn] 
			|| !writeStreams[ucFn].ws) return null;
		let ws = writeStreams[ucFn].ws;
		return Math.trunc(ws.writableLength/1024);
	}
	
	/** 
	 * @desc  test instrumentation.
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {boolean} true if currently writing to local queue.
	*/	
	getIsQueuing(ucFn) { 
		if (!this.isLogFile(ucFn) || logFiles[ucFn].isQueuing === undefined
			|| logFiles[ucFn].isQueuing === null) {
				return false;
			}
		return logFiles[ucFn].isQueuing;
	}
	
	/** 
	 * @desc  test instrumentation.
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {number} The number of logging statements held in local queue. 
	*/	
	getLocalQueueLength(ucFn) { 
		if (!this.isLogFile(ucFn)) return null;
		return logFiles[ucFn].localQueue.length;
	}
	
	/** 
	 * @desc  test instrumentation.
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {boolean} true if rolling now.
	*/
	getIsRolling(ucFn) {
		if (!this.isLogFile(ucFn) || logFiles[ucFn].isRolling === undefined
			|| logFiles[ucFn].isRolling === null) {
				return false;
			}
		return logFiles[ucFn].isRolling;
	}	
	
	/** 
	 * @desc  test instrumentation.
	 * @private
	 * @param {string} ucFn - key for a target logfile.
	 * @returns {fs.writeStream} writeStream for this logfile, or null.
	*/
	getWsStream(ucFn) {
		let record = writeStreams[ucFn];
		if (record && record.ws) {
			return record.ws;
		} else {
			return null; // no ws at this time
		}		
	}
	
	/** 
	 * @desc Will add the items in nuBits to the writeStream's record.
	 * @param {string} ucFn - key for a target logfile.
	 * @param {object} nuBits - object to add to the record for this ws.
	 * @returns {object} - the updated record. 
	 * @private
	*/
	updateRecord(ucFn, nuBits) {
		let record;
		record = writeStreams[ucFn];	
		if (!record) return null;
		record = Object.assign({}, record, nuBits);
		writeStreams[ucFn] = record;
		return record;		
	}
	
	/**
	 * @desc Returns a stream for a given logfile. 
	 * May have to create it, or replace existing ws.
	 * @private 
	 * @param {string} fn - The logfile.
	 * @param {boolean} replace - true to replace existing writeStream.
	 * @returns {fs.writeStream} The stream for a given logfile.
	*/
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
		touchFileSync(fn);		
		ws = this.createCustomWriter(fn); // create a new stream
		writeStreams[ucFn].ws = ws;
		return ws;		
	}
	
	/**
	 * @desc Check if any logfile needs rolled. 
	 * @private
	*/		
	checkRollingFiles() { 
	let ws;
		for (let ucFn in logFiles) {
			ws = (writeStreams[ucFn] && writeStreams[ucFn].ws) 
				? writeStreams[ucFn].ws 
				: null;
			if (ws && !writeStreams[ucFn].ready) {
				continue; // don't interrupt stream creation, rolling can wait.
			}			
			logFiles[ucFn].checkRollingFile(ws);
		}
	}
	
	/**
	 * @desc Sends events to listeners. Sends to all loggers using the logfile.
	 * @param {string} ucFn - key for a target logfile.
	 * @param {string} typeMsg - type of message to send (error, warn, or buffer).
	 * @param {number} msgCode - msgCode (codes are documented in README.MD).
	 * @param {object} detailObj - A stacktrace or details for msg type.
	 * @private
	*/
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
	
	// Recursive, since we (rarely) may need some extra time for the old stream to clean-up
	// after it closed the logfile, so may need a couple of retries.
	// Used after rolling the logfile with renaming strategy 
	// in MoveFile, since a new stream must then be created for the new logfile.
	/**
	 * @desc Called when an old writeStream is being replaced with a new one,
	 * normally called by a close event on a writeStream during the rolling 
	 * operation. It is asynchronous and recursive, usually taking none, 
	 * but sometimes an iter-or-two to wait for old writeStream to be closed.
	 * @param {string} fn - file needing the new stream.
	 * @param {integer} retryNum - how many more iterations allowed to try.
	 * @private
	*/
	async rollNewStream(fn, retryNum=0) {
		const ucFn = this.getUcFn(fn);
		// will wait for new logfile to be created before creating stream
		if (await accessFile(fn)) { //(existsSync(fn)) {
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
			setTimeout(async () => {
				this.rollNewStream(fn, ++retryNum);
			}, 200);		
		}		
	}
	
	/**
	 * @desc Initializes a new FileRec, or updates one.
	 * @param {string} fn - logfile name. 
	 * @param {string} ucFn - key for this logfile.
	 * @private
	*/
	logFileInit(fn, ucFn) {		
		try {
			// get current file information
			const fileStat = statSync(fn);
			const startSizeBytes = fileStat.size;
			const birthTimeMs = fileStat.birthtimeMs;		
			if (!logFiles[ucFn]) {
				logFiles[ucFn] = new FileRec(fn);
				logFiles[ucFn].on("GwLoggerSystemMsgx42022"
						, (gwMsgCode, fn, ws, err) => {
					let ucFn = this.getUcFn(fn);
					if (gwMsgCode === 4010) {
						this.rollNewStream(fn);
					} else if (gwMsgCode === 4021) {
						this.haltAllRolling(ucFn); // really only for this logfile
						this.send(ucFn, "warn", 3240, msg.warNoRoll01(fn), err);
					} else if (gwMsgCode === 4022) {
						this.haltAllRolling(ucFn); // for this logfile
						this.send(ucFn, "warn", 3241, msg.warNoRoll01(fn), err);
					} else if (gwMsgCode === 4020) {
						this.haltAllRolling(ucFn); // for this logfile
						if (ws) ws.end();
						this.send(ucFn, "warn", 3242, msg.warNoRoll01(fn), err);
					} else if (gwMsgCode === 4025) {
						logFiles[ucFn].truncate = true;
						logFiles[ucFn].startSizeKb = 0;
						logFiles[ucFn].birthTimeMs = Date.now();						
						if (ws) {
							ws.uncork();
							this.emptyLocalQueue(ucFn);
						}	
						logFiles[ucFn].isRolling = false;
					} else if (gwMsgCode === 4026) {
						logFiles[ucFn].truncate = false;
						if (writeStreams[ucFn] && writeStreams[ucFn].watcher) {
							writeStreams[ucFn].watcher.close();
						}							
						// An existing stream may continue writing in the moved fn 
						// location (inode) until stream-buffer empty and stream ends/closes.
						if (ws) ws.end(); // will uncork, end stream, and close file				
					} else if (gwMsgCode === 4030) {
						this.emptyLocalQueue(ucFn);
					} else {
						this.send(ucFn, "warn", 3010, msg.errUknown(fn), err);
					}
				});					
			}
			logFiles[ucFn].startSizeKb = startSizeBytes / 1024;
			logFiles[ucFn].birthTimeMs = birthTimeMs;
					
		} catch(err) {
			this.send(ucFn, "error", 3009, msg.errLfInit01(fn), err);
		}		
	}
	
	/**
	 * @desc Attempts to empty local logging queue to writeStream. 
	 * @param {string} ucFn - key for a target logfile.
	 * @private
	*/
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
			return; // queue left intact in case user can fix issue with file and setIsFile(true) again.
		}
		logFiles[ucFn].isQueuing = false;
	}
	
	/**
	 * @desc Create and init the fs writeStream for logfile fn.
	 * @param {string} fn - logfile name. 
	 * @private
	*/
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
			this.send(ucFn, "GwLoggerSystemMsgx42021", 3221, msg.warWpCw01(fn), err);
			this.haltAllRolling(ucFn);
			this.send(ucFn, "warn", 3221, msg.warWpCw01(fn), err); // for user info
		}
	}
	
	/**
	 * @desc Quit trying to roll logs for any logger using this file.
	 * @param {string} ucFn - key for a target logfile.
	 * @private
	*/
	haltAllRolling(ucFn) {
		if (this.isLogFile[ucFn]) {
			logFiles[ucFn].isRollBySize = false;					
			logFiles[ucFn].isRollAtStartup = false;
			logFiles[ucFn].isRollAsArchive = false;	
			this.send(ucFn, "GwLoggerSystemMsgx42021", 3242, msg.warRollOld01(ucFn));
		}		
	}
	
	/**
	 * @desc Verifies an existing stream for logfile, or kicks-off a new one.
	 * Normally called from Profiles.js when time comes to complete initializing a
	 * new logger.
	 * @param {string} fn - logfile name. 
	 * @param {boolean} replace - true to close old stream and init new one.
	 * @param {object} activeProfile - the current settings for initializing things.
	 * @returns {object} A writeStream (or nothing), but only for some testing.
	 * Program logic should never depend on getting a value back.
	 * @private
	*/
	verifyCreateWriteStream(fn, replace=false, activeProfile) {
		//this.defEvent();		
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
			fnExisted = touchFileSync(fn); // make sure the file exists
			this.logFileInit(fn, ucFn); // startup, setup registry for logfile			
			// add the logger's eventEmitter to the logfile's info
			if (logFiles[ucFn].loggerIds.indexOf(loggerId) === -1) {
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
			logFiles[ucFn].prerollFile(null); // roll logfile
		}
		// stream may not exist yet, but large file might, see if it needs rolled	
		else if (activeProfile.isRollBySize) {
			// perform rolling of logfiles and create a new stream
			logFiles[ucFn].checkRollingFile();
			if (!logFiles[ucFn].isRolling) {
				return this.getRegisteredStream(fn, replace);
			}
		} 
		else {
			return this.getRegisteredStream(fn, replace);
		}
	}
	
	/**
	 * @desc Write a log statement to the internal queue. Used when rolling. 
	 * is in progress, or a new writeStream is being created.
	 * @param {string} ucFn - key for a target logfile.
	 * @param {string} txt - log statement to write to queue.
	 * @private
	*/
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
	
	/**
	 * @desc Writes to the logfile's stream or localQueue. Called from GwLogger,
	 * and is the main entry point to log something to a logfile once formated
	 * by GwLogger.
	 * @param {string} loggerId - A unique logger ID for an instance of GwLogger.
	 * @param {string} ucFn - key for a target logfile.
	 * @param {string} txt - log statement to write to logfile.
	 * @returns {boolean} - false if getting backpressure from stream or if we 
	 * are currently writing to queue for any reason (usually rolling logfiles).
	 * @private
	*/
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

