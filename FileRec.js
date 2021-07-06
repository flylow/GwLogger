"use strict";

// exceptions to ESLint no-init rule
/*global console, setTimeout, clearTimeout, require, exports */

const existsSync = require("fs").existsSync;
const path = require("path");
const EventEmitter = require("events");

const moveFileZip = require("./fsprom.js").moveFileZip;
const moveFile = require("./fsprom.js").moveFile;
const unlinkFile = require("./fsprom.js").unlinkFile;
const accessFile = require("./fsprom.js").accessFile;
const utimesProm = require("./fsprom.js").utimesProm;
const statSync = require("fs").statSync;
const fs = require("fs");

const getTimeStamp = (new (require("./Timestamps.js").Timestamps)).getTimeStamp;
const version = "1.5.5";

/**
 * @class
 * @private
 * @desc Defines shared properties and state information for a logfile.
 * Most buffering occurs inside the stream object, as usual for writestreams. 
 * But during a roll event, a localQueue, defined below, takes over. Buffering 
 * to the localQueue usually only happens for a short period while waiting for 
 * the outgoing file to receive remainder of any buffer still held by an 
 * ended writestream. After which, a new writestream is created and takes over.
*/
class FileRec extends EventEmitter {
	constructor (fn=null, rollingLogPath = null, maxNumRollingLogs = 0
			, isRollAsArchive = false, archiveLogPath = null
			, isRollBySize = false, maxLogSizeKb = 0) {
		super();
		this.fn = fn;
		this.isRollBySize = isRollBySize; // Turns on rolling-by-size feature.
		this.rollingLogPath = rollingLogPath;
		this.maxNumRollingLogs = maxNumRollingLogs;
		this.maxLogSizeKb = maxLogSizeKb;
		this.isRollAsArchive = isRollAsArchive;
		this.archiveLogPath = archiveLogPath;
		this.oldBufferOk = true;
		this.isRolling = false; // currently in the rolling process?
		
		this.isQueuing = false; // direct logging for this file to the localQueue?
		this.localQueue = []; // The internal queue for this logfile
		
		this.loggerIds = []; // IDs of loggers using this logfile.
		
		this.startSizeKb = 0; // The size, in KB, of the logfile at startup
		this.birthTimeMs = null; // Timestamp for logfile's creation date/time.

		// If a log file is accidentally removed/renamed, a recovery process 
		//tries to re-create
		this.isInRecovery = false;
	}
	
	/** 
	 * @desc Test instrumentation.
	 * @returns {string} version number. */
	static getVersion() { 
		return version;
	}	

	/**
	 * @private
	 * @returns {number} Size, in KB, of logfile on disk.
	*/	
	getCurrentFileSizeKb() {
		const fn = this.fn;
		const fileStat = statSync(fn);
		return fileStat.size / 1024;
	}
	
	/**
	 * @desc Check if logfile size estimate is larger than target max set by user.
	 * @param {fs.writeStream} ws - The logfile's associated writeStream (or null)
	 * @returns {boolean} true if logfile needs rolled, else false.
	 * @private
	*/
	getNeedToRollSize(ws) {
		let currentSize = 0;
		if (this.isRolling) {
			return false; // already rolling...
		}
		// if ws is undefined (eg startup), ws buffer is empty and can be ignored
		if (!ws) { 
			if (this.startSizeKb  > this.maxLogSizeKb) {
				return true;
			}	
			else return false; 
		}
		if (this.truncate) { // Must use only current file size
			currentSize = this.getCurrentFileSizeKb();
		} else {
			currentSize = this.startSizeKb + ws.bytesWritten/1024
				+ Math.trunc(ws.writableLength/1024);
		}
		if (currentSize > this.maxLogSizeKb) {
			return true;
		} else {
			return false;
		}
	}	
	
	/**
	 * @desc Check if specific logfile needs rolled, then start the roll.
	 * @param {fs.writeStream} ws - The logfile's associated writeStream (or null)	 
	 * @private
	*/	
	checkRollingFile(ws=null) {
		if (this.fn
				&& this.isRollBySize 
				&& !this.isRolling 
				&& !this.isInRecovery 
				&& this.maxLogSizeKb > 0 
				&& (this.maxNumRollingLogs > 0
					|| this.isRollAsArchive) ) {
			if (this.getNeedToRollSize(ws)) {							
				this.prerollFile(ws);
			}
		} else if (this.fn && this.isQueuing) {
			// Corner-case if rolling was turned off due to an previous error, still need 
			//  to empty queue of any data and resume normal logging.
			this.emit("GwLoggerSystemMsgx42022", 4030
							, this.fn, ws, "call emptyLocalQueue");			
		}		
	}
	
	/**
	 * @desc The mostly-synchronous prelude to async rollFiles, used by WritePool.
	 * @param {fs.writeStream} ws - The logfile's associated writeStream (or null)	 
	 * @private
	*/	
	prerollFile(ws) { 
		if (this.isRolling) {
			return; // already rolling this fn
		}
		this.isRolling = true;
		this.isQueuing = true;
		const fn = this.fn;		
		// timer will keep app alive if rolling incomplete when app ends normally
		const timer = setTimeout(() => {
			console.error("Timer in GwLogger - FileRec.prerollFile expired after 1 hour.");
		}, 360000);			
		const p = new Promise( (resolve) => {
			let needNewStream = this.rollFiles(ws, fn);
			resolve(needNewStream);
			clearTimeout(timer);			
		});
		p.then((needNewStream) => {
			if (needNewStream || ws === null) {
				this.emit("GwLoggerSystemMsgx42022", 4010, fn, ws
					, "FileRec triggered a new stream");
			} 
		});
		p.catch((err) => {
			this.emit("GwLoggerSystemMsgx42022", 4051, fn, ws
				, err);
		});
	}
	
	/**
	 * @desc Determine timestamp and generate a file name for an archive.
	 * The name should include a timestamp from the file metadata (last modified 
	 * time).
	 * @param {string} oldFname - The path+file we want to archive.
	 * @param {string} path - The path to put compressed files (archives).
	 * @param {object} fnPath - a Path object for current actual logfile.
	 * @param {boolean} useFileTS - true to try and derive timestamp from file's 
	 * last-modified TS, else will use current time (former for fresh logfile, 
	 * latter for a rolled file, which could have been on drive a long time.
	 * @returns {string} path+filename for archived file. 
	 * @private
*/
	async createArchiveName(oldFname, path, fnPath, useFileTS, isBackup=false) {
		let nuFnameObj = {nuFname: null, conflict: false};
		const timeStampFormat = {isShowMs: false, nYr: 4, sephhmmss: ""};
		let ms = this.getMtimeMs(oldFname, useFileTS, isBackup);
		let ts = getTimeStamp(timeStampFormat, ms);
		if (!path) path = fnPath.dir; // use logfile path
		let nuFname = path + "/" + fnPath.name + "_" 
			+ ts + fnPath.ext + ".gz"; // use time from file record
		if (existsSync(nuFname)) { // naming conflict
			nuFnameObj.conflict = true; // Backup function will need to know
			ts = getTimeStamp(timeStampFormat, Date.now()+1);
			nuFname = path + "/" + fnPath.name + "_" 
				+ ts + fnPath.ext + ".gz";	 // use current time + 1ms	
		}
		nuFnameObj.nuFname = nuFname;
		return nuFnameObj;
	}
	
	/**
	 * @desc Perform logfile roll.
	 * @param {fs.writeStream} ws - The logfile's associated writeStream (or null)
	 * @param {string} fn - the logfile to roll. 
	 * @returns {boolean} - true if a new writeStream should be generated.
	 * @private
	*/
	async rollFiles(ws, fn, isBackup=false) {	
		const fnPath = path.parse(fn);
		const maxNum = this.maxNumRollingLogs;
		let nuFname = "", nuFnameObj;
		let rollingLogPath = this.rollingLogPath;
		if (!rollingLogPath) rollingLogPath = fnPath.dir; // logfile directory!
		const isArchive = this.isRollAsArchive;
		let archiveLogPath = this.archiveLogPath;
		if (!archiveLogPath) archiveLogPath = rollingLogPath;		
		// Make sure logfile exists (it IS possible to delete a logfile)
		if (!existsSync(fn)) {
			if (ws) ws.end(); // stop the stream's buffer from attempting to write to deleted file				
			return false;
		}
		if (maxNum > 0) {
			nuFname = rollingLogPath + "/" + fnPath.name + "_" 
				+ (""+1).padStart(3,0) + fnPath.ext; // to be most recently rolled
			nuFnameObj={nuFname: nuFname, conflict: false};
			await this.rollLogtrain(fnPath, ws, rollingLogPath
						, isArchive, archiveLogPath);	
		} else if (isArchive) { // roll direct to archive
			nuFnameObj = await this.createArchiveName(fn
				, archiveLogPath, fnPath, true, isBackup);
		}			
		// roll current logfile
		try { 
			if (ws && ws.writableCorked === 0) {
				ws.cork(); // stop the stream's buffer from attempting to write to file		
			}
			if (isBackup) {
				//no-op in this release
			} else {
				await this.rollLogfile(fn, nuFnameObj.nuFname, ws, isArchive);
			}
		} catch(err) {
			// An unanticipated error, likely in moveFile			
			// Try to recover without bringing down the application,
			// make sure there is a logfile at very least
			if (!existsSync(fn)) {
				if (ws) ws.end(); // kill the old stream				
				return false;
			}
			this.emit("GwLoggerSystemMsgx42022", 4020, fn, ws, err); 			
			return false; 
		}		
		return false;
	}

	/**
	 * @desc Rename or move all the previously rolled logfiles (001 to 002, 
	 * 002 to 003, etc). The highest number rolled file will be deleted or 
	 * archived.
	 * @param {fs.writeStream} ws - The logfile's associated writeStream (or null)
	 * @param {object} fnPath - a Path object for current actual logfile.
	 * @param {string} rollingLogPath - path where rolled logs are stored.
	 * @param {boolean} isArchive - true if last rolled file will be archived.
	 * @private
	 */
	async rollLogtrain(fnPath, ws, rollingLogPath, isArchive, archiveLogPath) {
		let oldFname, nuFname;
		const maxNum = this.maxNumRollingLogs;
		for (let oldFnum = maxNum; oldFnum > 0; oldFnum--) {
			let nuFnum = oldFnum + 1;
			oldFname = rollingLogPath + "/" + fnPath.name 
				+ "_" + (""+oldFnum).padStart(3,0) + fnPath.ext; 
			if (oldFnum === maxNum 
					&& await accessFile(oldFname) ) {
				if (isArchive) {
					let nuFnameObj = await this.createArchiveName(oldFname
						, archiveLogPath, fnPath, true);
					let nuFname = nuFnameObj.nuFname;
					try {
						let ms = this.getMtimeMs(oldFname, true); // get mtimeMs
						await moveFileZip(oldFname, nuFname, true);
						ms = Math.floor(ms/1000);		
						await utimesProm(nuFname, ms, ms); //sync last-modified time with original
					} catch(err) {
						this.emit("GwLoggerSystemMsgx42022", 4021
							, this.fn, ws, err);
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
						this.emit("GwLoggerSystemMsgx42022", 4022
							, this.fn, ws, err);					
					}
				}
			}
		}
	}
	getMtimeMs(oldFname, useFileTS, isBackup=false) {
		const currentTimeMs = Date.now();
		let ms = null;
		if (useFileTS) {
			const stats = fs.statSync(oldFname);
			ms = stats.mtimeMs; // last time file was modified
			const oneYearMs = 31536000000;
			// If a machine or network drive isn't setting times correctly
			// on the file system, then use current time in file name.
			if (!isBackup && (currentTimeMs - ms) > oneYearMs) ms = currentTimeMs;
		}
		return ms; // okay to return null	
	}

	/**
	 * @desc After renaming all the old rolled-files up one (out of the way),
	 * then this method renames or moves the actual current logfile to 
	 * position 001.
	 * @param {string} fn - logfile to roll.
	 * @param {string} nuFname - name for rolled version of logfile.
	 * @param {fs.writeStream} ws - The logfile's associated writeStream (or null)
	 * @param {boolean} isArchive - true if last rolled file will be archived.
	 * @private
	 */	
	async rollLogfile(fn, nuFname, ws, isArchive) {
		let typeOfMove;
		let ms = this.getMtimeMs(fn, true, false);
		typeOfMove = (isArchive && this.maxNumRollingLogs === 0)
			? await moveFileZip(fn, nuFname, true)
			: await moveFile(fn, nuFname, true);
		if (!typeOfMove || typeOfMove === "none") { 
			throw("typeOfMoveIsNone"); // caught by caller (rollFiles) method
		} else if (typeOfMove === "trunc") { // truncated logfile fn to 0 length
			this.emit("GwLoggerSystemMsgx42022", 4025, fn, ws
				, "FileRec truncated the logfile");
		} else { // typeOfMove === "renamed"
			this.emit("GwLoggerSystemMsgx42022", 4026, fn, ws
				, "FileRec renamed the logfile");
		}		
		try {		
			ms = Math.floor(ms/1000);		
			await utimesProm(nuFname, ms, ms); //sync last-modified time with original
		} catch(err) {
		}			
		return typeOfMove;
	}
	
}
	
exports.FileRec = FileRec;
