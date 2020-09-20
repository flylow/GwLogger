"use strict";
/*global console, exports, require */ // A directive for exceptions to ESLint no-init rule
/*
 * On the local file system, one can move a file with fs.rename, but if the file to be moved
 * is on a network drive it must be copied more tediously and the original deleted.
*/

const fs = require("fs");
const promisify = require("util").promisify;
const renameProm = promisify(fs.rename);
const unlinkProm = promisify(fs.unlink);


const renameFile = async function(path, newPath) {
	return await renameProm(path, newPath);
};

const copyFile = async function (path, newPath, flags) {
	const readStream = fs.createReadStream(path);
	const writeStream = fs.createWriteStream(newPath, {flags});
	readStream.pipe(writeStream);
};

const unlinkFile = async function(path) { 
	await unlinkProm(path);
};

/*
 * On the local file system, one can move a file with fs.rename, but if the file to be moved
 * is on a network drive it must be copied more tediously and the original deleted. So, try
 * renameFile, but if that fails do a copyFile.
*/
const moveFile = async function(path, newPath, flags) {
	try {
		await renameFile(path, newPath);
    } catch(err) {
		if (err.code !== "EXDEV" && err.code !== "EPERM") {
			throw("Error in moveFile via renameFile: ", err);
		}
		else {
			try {
				await copyFile(path, newPath, flags);
				return await unlinkFile(path);
			} catch(err) {
				console.log("Error in GwLogger moveFile: ", err);
				throw err;
			}
		}
    }
};

exports.moveFile = moveFile;
exports.unlinkFile = unlinkFile;
