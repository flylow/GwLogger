"use strict";

// A directive for exceptions to ESLint no-init rule
/*global exports, require */ 

/*
 * On the local file system, one can move a file with fs.rename, but if the file
 * to be moved is on a network drive it must be copied more tediously and the
 * source file deleted. If the source is locked at the time of moving, such as by
 * a tailing program, then a more drastic solution, that of truncating the source
 * file, is used.
*/

const fs = require("fs");
const createWriteStream = require("fs").createWriteStream;
const createReadStream = require("fs").createReadStream;
const promisify = require("util").promisify;
const renameProm = promisify(fs.rename);
const unlinkProm = promisify(fs.unlink);
const truncProm = promisify(fs.truncate);
const accessProm = promisify(fs.access);
const version = "1.2.0";

const accessFile = async function(path, mode=fs.constants.F_OK) {
	try {
		await accessProm(path, mode);
		return true;
	} catch(err) {
		return false;
	}
};

const truncFile = async function(path, keep=0) {
	try {
		await truncProm(path, keep);
	} catch(err) {
		throw(err);
	}
};

const renameFile = async function(path, newPath) {
	try {
		await renameProm(path, newPath);
	} catch(err) {
		throw(err);
	}
};

const copyFile = async function (path, newPath, flags) {
	const readStream = createReadStream(path);
	const writeStream = createWriteStream(newPath, {flags});
	await new Promise(resolve => 	
		readStream.pipe(writeStream).on("finish", resolve));
};

const unlinkFile = async function(path) { 
	try {
		await unlinkProm(path);
	} catch(err) {
		throw(err);
	}
};

/*
 *
 * Try renameFile, but if that fails do a copyFile. If the file being copied 
 * cannot be deleted, then delete (via truncate) the contents if isTrunc is 
 * true (as it is during a roll of the current logfile).
 * return the type of action as a string (rename, unlink, or trunc).
*/
const moveFile = async function(path, newPath, isTrunc, flags) {
	try {
		await renameFile(path, newPath); // Fast on local drives
		return "rename"; // All is good
	// various errors, especially on a network drive OR if tailing the logfile	
    } catch(err) {
		if (err.code === "ENOENT") {
			return "none"; // file to roll didn't exist
		}
		else if (err.code !== "EXDEV" && err.code !== "EPERM" 
				&& err.code !== "EBUSY") {
			throw("Error in moveFile via renameFile: ", err);
		}
		else {				
			try {
				await copyFile(path, newPath, flags);
			} catch(err) {
				throw("Error in moveFile after copyFile attempt: \n" + err);
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
					throw("Error in moveFile after unlinkFile try: \n" + err);
			}
		}
    }
};

exports.moveFile = moveFile;
exports.truncFile = truncFile;
exports.unlinkFile = unlinkFile;
exports.accessFile = accessFile;

