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
/*global module, console, setTimeout, require */

const createWriteStream = require("fs").createWriteStream;
const watch = require("fs").watch;
const existsSync = require("fs").existsSync;
const path = require("path");
const statSync = require("fs").statSync;
const closeSync = require("fs").closeSync;
const openSync = require("fs").openSync;

const moveFile = require("./fsprom.js").moveFile;
const unlinkFile = require("./fsprom.js").unlinkFile;
const accessFile = require("./fsprom.js").accessFile;

const version = "1.2.2";

/*
Most buffering occurs inside the stream object, as usual for writestreams. 
But during a roll event, a localQueue, defined below, takes over. Buffering 
to the localQueue usually only happens for a short period while waiting for 
the outgoing file to receive remainder of any buffer still held by an 
ended writestream. After which, a new writestream is created and takes over.
*/

let writeStreams = {}; // contains fs.writeStream(s) and properties
let logFiles = {}; // contains LogFileRecs

// Holds properties and state information for a logfile
class LogFileRec {
	constructor (isRollBySize = false, rollingLogPath = null
		, maxNumRollingLogs = 0, maxLogSizeKb = 0) {
		this.isRollBySize = isRollBySize; // Turns on rolling-by-size feature.
		this.rollingLogPath = rollingLogPath;
		this.maxNumRollingLogs = maxNumRollingLogs;
		this.maxLogSizeKb = maxLogSizeKb;
		
		this.isRolling = false; // currently in the rolling process
		
		this.isQueuing = false; // directs logging for this file to the localQueue
		this.localQueue = []; // The internal queue for this logfile
		
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
	
	// ucFn is "upper-case file name" without any whitespace, and is
	// used as a key for logfile records and streams.
	getUcFn(fn) { 
		if (!fn) return null;
		fn = path.resolve(fn);
		return fn.replace(/\s+/g, "").toUpperCase();
	}
	
	//		methods for roll at startup
	
	setIsRollAtStartup(ucFn, b) { // Is unsupported API
		logFiles[ucFn].isRollAtStartup = b;
	}	
	getIsRollAtStartup(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].isRollAtStartup 
			: null;
	}
		
	// 		methods for roll by size settings
	
	setIsRollBySize(ucFn, b) {
		if (!logFiles || !logFiles[ucFn]) return null;
		logFiles[ucFn].isRollBySize = b;
		return b;
	}	
	getIsRollBySize(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].isRollBySize 
			: null;
	}
	
	setMaxLogSizeKb(ucFn, kb) { // approx max for each logfile
		if (!logFiles || !logFiles[ucFn]) return null;
		this.setIsRollBySize(ucFn, false);
		logFiles[ucFn].maxLogSizeKb = kb;
		return kb;
	}
	getMaxLogSizeKb(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].maxLogSizeKb 
			: null;
	}

	setMaxNumRollingLogs(ucFn, n) { // how many logfiles to keep
	if (!logFiles || !logFiles[ucFn]) return null;
		this.setIsRollBySize(ucFn, false);
		logFiles[ucFn].maxNumRollingLogs = n;
		return n;
	}	
	getMaxNumRollingLogs(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].maxNumRollingLogs 
			: null;
	}

	// set the path to store old logfiles. Must be cleaned first by Profiles.
	setRollingLogPath(ucFn, rollPath) { 
		if (!logFiles || !logFiles[ucFn]) return null;
		this.setIsRollBySize(ucFn, false);
		logFiles[ucFn].rollingLogPath = rollPath;
		return true;
	}	
	getRollingLogPath(ucFn) {
		return (logFiles && logFiles[ucFn]) 
			? logFiles[ucFn].rollingLogPath 
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
		return Math.round(ws.writableLength/1024);
	}
	
	// test instrumentation
	getIsQueuing(ucFn) { 
		if (!logFiles || !logFiles[ucFn] || logFiles[ucFn].isQueuing === undefined
			|| logFiles[ucFn].isQueuing === null) {
				return false;
			}
		return logFiles[ucFn].isQueuing;
	}
	
	// test instrumentation
	getIsRolling(ucFn) {
		if (!logFiles || !logFiles[ucFn] || logFiles[ucFn].isRolling === undefined
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
		record = {...record, ...nuBits};
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
		if (replace && record) {
			try {
				if (record.watcher) {
					record.watcher.close();
					record.watcher = null;
				}
			}
			catch(err) {
				throw msg.errWatch01(fn);
			}
		}	
		if (replace && record && record.fd) {
			record.fd = null;
		}
		writeStreams[ucFn] = {}; // clean slate for this file record
		writeStreams[ucFn].ready = false;
		// Make sure the file exists already, or the stream's lazy file create process
		// may not beat other dependencies (esp. watcher)		
		this.touch(fn);
		ws = this.createCustomWriter(fn); // create a new stream, maybe a logfile
		writeStreams[ucFn].ws = ws;
		return ws;		
	}
	
	// Check if logfile size estimate is larger than target max set by user
	// ws is writeStream, ucFn is upper-case-filename
	getNeedToRollSize(ws, ucFn) {
		let currentSize = 0;
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
				+ ws.writableLength/1024;
		}
		if (currentSize > logFiles[ucFn].maxLogSizeKb) {
			return true;
		} else {
			return false;
		}
	}	
	
	// Check to see if it is time to roll	
	checkRollingFiles() { 
		let ws;
		for (let ucFn in logFiles) {
			if (logFiles[ucFn].isRollBySize 
					&& !logFiles[ucFn].isRolling 
					&& !logFiles[ucFn].isInRecovery 
					&& logFiles[ucFn].maxLogSizeKb > 0 
					&& logFiles[ucFn].maxNumRollingLogs > 0) {
				ws = writeStreams[ucFn].ws;
				if (ws && !writeStreams[ucFn].ready) {
					continue;
				}
				if (this.getNeedToRollSize(ws, ucFn)) {
					//++++++++ Need to roll due to size
					this.preRollFiles(ucFn);
				}
			}
		}
	}
	
	// The mostly-synchronous prelude to async rollFiles
	preRollFiles(ucFn) {
		logFiles[ucFn].isRolling = true;
		logFiles[ucFn].isQueuing = true;
		const fn = logFiles[ucFn].fn;		
		const ws = (writeStreams[ucFn] && writeStreams[ucFn].ws) 
			? writeStreams[ucFn].ws 
			: null;			
		const p = new Promise( (resolve) => {
			let needNewStream = this.rollFiles(ucFn, ws, fn);
			resolve(needNewStream);
		});
		p.then((needNewStream) => {
			if (needNewStream || ws === null) {
				this.rollNewStream(fn);
			} 
		});
	}
	
	// Perform logfile roll
	async rollFiles(ucFn, ws, fn) {	
		let nuFname = "";
		const rollingLogPath = logFiles[ucFn].rollingLogPath;
		const fnPath = path.parse(fn);
		let typeOfMove;
		nuFname = rollingLogPath + "/" + fnPath.name + "_" 
			+ (""+1).padStart(3,0) + fnPath.ext; // to be most recently rolled				
		await this.rollLogtrain(ucFn, fnPath, rollingLogPath);		
		// move current logfile to temporary stash
		try {
			if (ws) ws.cork(); // stop the stream's buffer from writing to file				
			typeOfMove = await this.rollLogfile(fn, nuFname, ucFn, ws);					
		} catch(err) {
			// An unanticipated error, likely in moveFile			
			// Try to recover without bringing down the application
			// make sure there is a logfile at very least, clean-up and exist
			console.error(msg.warNoRoll01(fn), err);			
			logFiles[ucFn].isRollBySize = false; // turn off rolling for logfile 						
			if (ws) ws.end();
			return true; // exit rollFiles and do rollNewStream
		}		
		if (typeOfMove === "trunc") {
			logFiles[ucFn].isRolling = false;
		}
		return false; // so don't immediately rollNewStream
	}

	async rollLogtrain(ucFn, fnPath, rollingLogPath) {
		let oldFname, nuFname;
		const maxNum = logFiles[ucFn].maxNumRollingLogs;
		try {
			for (let oldFnum = maxNum; oldFnum > 0; oldFnum--) {
				let nuFnum = oldFnum + 1;
				oldFname = rollingLogPath + "/" + fnPath.name 
					+ "_" + (""+oldFnum).padStart(3,0) + fnPath.ext; 
				if (oldFnum === maxNum 
						&& await accessFile(oldFname) ) {
					await unlinkFile(oldFname); // delete the oldest one
				} else {
					if (oldFnum < maxNum) {
						nuFname = rollingLogPath + "/" + fnPath.name + "_" 
							+ (""+nuFnum).padStart(3,0) + fnPath.ext; 
						try {
							await moveFile(oldFname, nuFname);
						} catch(err) {
							console.error(msg.warRollOld01 + oldFname, err);
							// don't throw
						}
					}
				}
			}
		} catch(err) {
			// catch and release
		}
	}
	
	async rollLogfile(fn, nuFname, ucFn, ws) {
		const typeOfMove = await moveFile(fn, nuFname, true);
		if (!typeOfMove || typeOfMove === "none") { 
			throw("typeOfMoveIsNone"); // is caught in rollFiles method
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
		// will wait for new logfile to be created before creating stream
		if (existsSync(fn)) {
			this.getRegisteredStream(fn, true); // replace ws in writeStreams obj
			this.emptyLocalQueue(this.getUcFn(fn));
			return;			
		}
		else {
			try {
				const fd = openSync(fn, "w"); // make sure file exists
				closeSync(fd);
			} catch(err) {
				if (retryNum >= 20) {
					console.error(msg.errNotOpen(fn));
					logFiles[this.getUcFn(fn)].isRollingError = 100; // cannot open file, giving up.
					logFiles[this.getUcFn(fn)].localQueue = []; // can never save to file.
					return; // give up, abandon logfile queue, fatal.
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
			throw msg.errLfInit01(fn);
		}		
	}
	
	emptyLocalQueue(ucFn) {
		const ws = writeStreams[ucFn].ws;
		try {
			while (logFiles[ucFn].localQueue.length > 0) {
				ws.write(logFiles[ucFn].localQueue.shift(), "utf8");
			}
		} catch(err) {
			console.error(msg.errQ01(logFiles[ucFn].localQueue.length, logFiles[ucFn].fn), err);
			logFiles[ucFn].isRollingError = 101; // cannot write queue!
			logFiles[ucFn].localQueue = []; // can never write to file.	
			return;
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
		// Make sure the file exists
		this.logFileInit(fn, ucFn);	
		logFiles[ucFn].isQueuing = isQ; 
		logFiles[ucFn].isRolling = isR;	
		try {
			// note on using flags: "a+" does not work on Linux or MAC...
			ws = createWriteStream(fn
				, {flags: "a", autoclose: false, emitClose: true});
			ws.on("error", (err) => {
				// If the fd was previously closed by the finish event handler,
				// the ws's close event will throw an error when it tries to 
				// close the fd, so will ignore those errors here.
				if (!ucFn || !writeStreams[ucFn] || writeStreams[ucFn].fd 
					|| err.code !== "EBADF" || err.syscall !== "close") {
					console.error(msg.errUE01,err);
					//throw(err);
				} 
			});

			ws.on("open", (fd) => {
				this.updateRecord(ucFn, {fd: fd} ); // save the file descriptor
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
				writeStreams[ucFn].ready = true;
				logFiles[ucFn].isRolling = false;				
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
					}
				});	
				watcher.on("error",	(err) => {
					console.error(msg.warWat01(fn), err);
				});			
			}
			catch(err) {
				console.error(msg.warWat02(fn)); // A warning, will continue
			}
			if (watcher) {
				this.updateRecord(ucFn, { // save reference to watcher
					watcher: watcher 
				});
			}
			return ws;
		} catch(err) {
			console.error(msg.errWpCw01(fn));
		}
	}
	
	// Will return an existing stream for logfile, or have a new one created
	getStream(fn, replace=false, activeProfile) {
		let ucFn = this.getUcFn(fn);
		let fnExisted;
		if (writeStreams && writeStreams[ucFn] && writeStreams[ucFn].ws) {
			return this.getRegisteredStream(fn, replace);
		}
		if (!writeStreams || !writeStreams[ucFn]) {
			fnExisted = this.touch(fn); // make sure the file exists
			this.logFileInit(fn, ucFn); // startup, setup registry for logfile
			// These activeProfile values are from JSON profile, env vars, 
			// and/or built-in defaults
			this.setIsRollAtStartup(ucFn, activeProfile.isRollAtStartup);
			this.setMaxLogSizeKb(ucFn, activeProfile.maxLogSizeKb);
			this.setMaxNumRollingLogs(ucFn, activeProfile.maxNumRollingLogs);
			this.setRollingLogPath(ucFn, activeProfile.rollingLogPath);			
			// setIsRollBySize must be last, after other roll-by-size settings
			this.setIsRollBySize(ucFn, activeProfile.isRollBySize);
		}
		if (fnExisted && activeProfile.isRollAtStartup 
				&& activeProfile.rollingLogPath 
				&& activeProfile.maxNumRollingLogs > 0) {
			this.preRollFiles(ucFn); // perform rolling of logfiles
			return;
		}
		// stream may not exist yet, but file might, see if it needs rolled		
		else if (activeProfile.isRollBySize && this.getNeedToRollSize(null, ucFn)) {
			return this.preRollFiles(ucFn); // perform rolling of logfiles
		} 
		else {
			return this.getRegisteredStream(fn, replace);
		}
	}
	
	writeToQueue(ucFn, txt) {
		if (logFiles[ucFn].isRollingError > 99)  {
			throw "nofileorstreamfatal";
		}
		logFiles[ucFn].localQueue.push(txt);
	}
	
	// Writes to the logfile's stream or localQueue
	write(ucFn, txt) {
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
			return bufferOk;
		} catch(err) {
			if (logFiles[ucFn].isRollingError > 99) {
				throw {isRollingError: logFiles[ucFn].isRollingError, errName: "nofileorstreamfatal"};
			}
			const fn = (logFiles && logFiles[ucFn]) 
				? logFiles[ucFn].fn 
				: msg.unknown;
				console.error(msg.errWpw01(fn), err);
				logFiles[this.getUcFn(fn)].isWritePoolError = 100; // cannot write!	
				throw {isWritePoolError: logFiles[ucFn].isWritePoolError, errName: "cannotwritefatal"};			
		}
	}
}

const msg = {
	errWatch01: (s1) => {return `ERROR in GwLogger.WritePool 
closing record.watcher for fn: ${s1}\n`;},
	warRollOld01: "WARNING: Cannot roll: ",
	errLfInit01: (s1) => {return `logFileInit error with file: ${s1} `;},
	errQ01: (s1, s2) => {return `Error writing local buffer to file, len is: ${s1}, file is: ${s2}; will stop logging to file.\n`;},
	errUE01: "Unexpected error in GwLogger.WritePool: ",
	errWpw01: (s1) => {return `Error in GwLogger.WritePool.write logging to file: ${s1}\n`;},
	warNoRoll01: (s1) => {return `GwLogger with error moving logfile: ${s1} --turning off rolling.\n`;},
	warWat01: (s1) => {return `WARNING: error watching logfile: ${s1}\n`;},
	warWat02: (s1) => {return `WARNING: unable to define GwLogger.writePool watcher for: ${s1}`;},
	errWpCw01: (s1) => {return `ERROR, In WritePool.createCustomWriter for file: ${s1}\n`;},
	errNotOpen: (s1) => {return `ERROR: GwLogger cannot open file: ${s1}, and will stop logging to file.`;},	
	unknown: "unknown"
};

const writePool = new WritePool();

module.exports = writePool;

