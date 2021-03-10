"use strict";

// A directive for exceptions to ESLint no-init rule
/*global exports, console, require */ 

/**
 * @overview 
 * A set of file utilities wrapped in promises. These functions used
 * for moving files, zipping files, etc.
 *
 * All functions herein are only used internally. Methods and objects 
 * may change their form, function, or be removed.
*/

const fs = require("fs");
const zlib = require("zlib");
const createWriteStream = require("fs").createWriteStream;
const createReadStream = require("fs").createReadStream;
const promisify = require("util").promisify;
const renameProm = promisify(fs.rename);
const unlinkProm = promisify(fs.unlink);
const truncProm = promisify(fs.truncate);
const accessProm = promisify(fs.access);
const openProm = promisify(fs.open);
const closeProm = promisify(fs.close);
const utimesProm = promisify(fs.utimes);
const closeSync = require("fs").closeSync;
const openSync = require("fs").openSync;
const existsSync = require("fs").existsSync;
const version = "1.5.3";

/** 
 * @returns {string} Current version 
 * @private 
*/
const getVersion = () => {
	return version;
};
	
/**
 * @desc Determines if a file exists and (by default here) is currently available for writing. 
 * A thin wrapper around fs.access.
 * @param {String} path - file to check .
 * @param {integer} mode - flag specifying type of access to check for.
 * @returns {boolean} true if file exists and is currently writable, else false.
 * @private 
*/
const accessFile = async function(path, mode=fs.constants.W_OK) {
	try {
		await accessProm(path, mode);
		return true;
	} catch(err) {
		return false;
	}
};

/**
 * @desc Creates a file, asynchronously, if it didn't already exist.
 * However, it does not change last modification timestamps for existing files.
 * @param {string} fn - file to touch.
 * @returns {boolean} true if file already existed, false if not.
 * @private
*/ 
const touchFile = async function(fn) {
	if (!await accessFile(fn)) {
		await closeProm(await openProm(fn, "w")); 
		return false; // file did not previously exist
	} else {
		return true; // file did already exist
	}
};

	/**
	 * @desc Synchronous version of touchFile. 
	 * @param {string} fn - file to touch.
	 * @returns {boolean} true if file already existed, false if not.
	 * @private
	*/ 
const touchFileSync = function(fn) {
	if (!existsSync(fn)) {
		closeSync(openSync(fn, "w")); 
		return false; // file did not previously exist
	} else {
		return true; // file did already exist
	}
};

/**
  * @desc Truncates a file, by default removes all content. 
  * Useful when a file cannot be renamed or deleted for some reason (opened by 
  * another program for read, some network files are two cases).
  * A thin wrapper around fs.truncate.
  * @param {string} path - path to file to delete.
  * @param {integer} keep - number of bytes to keep, from top of file.
  * @private 
*/
const truncFile = async function(path, keep=0) {
		await truncProm(path, keep);
};

/**
 * @desc Renames/moves a file. A thin wrapper around fs.rename.
 * @param {string} path - file to rename. 
 * @param {string} newPath - new name (and/or place).
 * @private 
*/
const renameFile = async function(path, newPath) {
		await renameProm(path, newPath);
};

/**
 * @desc Copies a file from one location to another.
 * @param {string} path - file to be moved.
 * @param {string} newPath - new location for file.
 * @param {string} flags - passed to createWriteStream for new file, defaults to 'w'.
 * @private 
*/
const copyFile = async function (path, newPath, flags) {
	const readStream = createReadStream(path);
		const writeStream = createWriteStream(newPath, {flags});
		await new Promise(resolve => 	
		readStream.pipe(writeStream).on("finish", resolve));
};

/**
 * @desc Copies a file from one location to another, compressing the file along the way.
 * @param {string} path - file to be moved.
 * @param {string} newPath - new location for file.
 * @param {string} flags - passed to createWriteStream for new file, defaults to 'w'.
 * @private 
*/
const zipFile = async function (path, newPath, flags) {
	const readStream = createReadStream(path);
	const writeStream = createWriteStream(newPath, {flags});
	await new Promise(resolve => 	
		readStream.pipe(zlib.createGzip()).pipe(writeStream).on("finish", resolve));
};

/**
 * @desc Attempts to delete the file. A thin wrapper around fs.unlink.
 * @param {string} path - file to remove.
 * @private 
*/
const unlinkFile = async function(path) { 
		await unlinkProm(path);
};

/**
 * @desc Moves a file, compressing it along the way.
 * @param {string} path - file to move and zip.
 * @param {string} newPath - new file spec.
 * @param {boolean} isTrunc - true to truncate. 
 * rather than delete. Will always be true with primary logfile.
 * @param {string} flags - used by fs.createWriteStream during piping operation, 
 * defaults to 'w'.
 * @returns {string} 'rename', 'unlink' or 'trunc'. How move was accomplished, 
 * unlinking the old file or truncating it.
 * @private 
*/
const moveFileZip = async function(path, newPath, isTrunc, flags) {
	try {
		await zipFile(path, newPath, flags);
	} catch(err) {
	console.error("In moveFileZip, err is: ", err);
		throw msg.errMv03(path);
	}
	try {
		if (isTrunc) { // used with initial logfile only
			await truncFile(path);
			return "trunc";
		} else {
			await unlinkFile(path); // for rolling numbered logs over
			
			return "unlink"; // Success, all is good
		}
	} catch(err) {
			throw msg.errMv02(path);
	}	
};


/**
 * @desc Move a file. Tries renameFile first, but if that fails then 
 * does a copyFile.
 * If the file being copied cannot be deleted, then remove (via truncate) the
 * contents if isTrunc is true (as it is during a roll of the main logfile).
 * return the type of action as a string (rename, unlink, or trunc).
 *
 * On the local file system, one can move a file with fs.rename, but if the file
 * to be moved is on a network drive it must be copied more tediously and the
 * source file deleted. Similarly, if the source is locked at the time of 
 * moving, such as by a tailing program, then a more drastic solution, 
 * that of truncating the source file, is used. In such a case, the tailing 
 * program will be little-affected.
 *  
 * @param {string} path - file to be moved.
 * @param {string} path - new file spec. 
 * @param {boolean} isTrunc - true if should use truncate instead of unlink.
 * @returns {string} 'rename', 'unlink' or 'trunc'. How move was accomplished, 
 * unlinking the old file or truncating it.
 * @private 
*/
const moveFile = async function(path, newPath, isTrunc, flags) {
	try {
		await renameFile(path, newPath); // Fast on local drives
		return "rename"; // All is good
    } catch(err) {
		if (err.code === "ENOENT") {
			return "none"; // file to roll didn't exist
		}
		else if (err.code !== "EXDEV" && err.code !== "EPERM" 
				&& err.code !== "EBUSY") {
			console.error(msg.errMv01(path)); // Unexpected error, 
			throw err; // and should be investigated
		}
		else {				
			try {
				await copyFile(path, newPath, flags);
			} catch(err) {
				throw msg.errMv03(path);
			}
			try {
				if (isTrunc) { // used with initial logfile only
					await truncFile(path);
					return "trunc";
				} else {
					await unlinkFile(path); // for rolling numbered logs over
					return "unlink"; // Success, all is good
				}
			} catch(err) {
					throw msg.errMv02(path);
			}
		}
    }
};


const msg = {
	errMv01: (s1) => { return `Error in moveFile via renameFile: ${s1}`;},
	errMv02: (s1) => { return `Error in GwLogger moveFile after unlinkFile try: ${s1}`;},
	errMv03: (s1) => { return `Error in moveFile after copyFile attempt: ${s1}`;}
};


exports.moveFile = moveFile;
exports.moveFileZip = moveFileZip;
exports.zipFile = zipFile;
exports.copyFile = copyFile;
exports.truncFile = truncFile;
exports.unlinkFile = unlinkFile;
exports.accessFile = accessFile;
exports.utimesProm = utimesProm;
exports.touchFile = touchFile;
exports.touchFileSync = touchFileSync;
exports.getVersion = getVersion;

