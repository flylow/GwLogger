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
const readdirProm = promisify(fs.readdir);
const readProm = promisify(fs.read);
const writeProm = promisify(fs.write);
const mkdirProm = promisify(fs.mkdir);
const copyFileProm = promisify(fs.copyFile);
const pathpath = require("path");
const closeSync = require("fs").closeSync;
const openSync = require("fs").openSync;
const existsSync = require("fs").existsSync;
const crypto = require("crypto");
const pbkdf2Prom = promisify(crypto.pbkdf2);
const { Transform } = require('stream');
const version = "1.5.4";

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

let tempHeaderDec;
const decrypt = async function(file, password, key, iv) {
console.log("In decrypt for: ", file);
	// First, get the initialization vector from the file.
	//const readInitVect = fs.createReadStream(file, { end: 15 });
	let initVect;
/*	
  	await new Promise(resolve =>
		readInitVect.on('data', (chunk) => {
			initVect = chunk;
			console.log("In decrypt, len of header is: ", initVect.length, ", equal?: ", (tempHeaderDec.equals(initVect)), tempHeaderDec, initVect);
			console.log("still in decrypt, Buffer.isBuffer(initVect) : ", Buffer.isBuffer(initVect), ", Buffer.isBuffer(tempHeaderDec): ", Buffer.isBuffer(tempHeaderDec));
			resolve(true);
		})
	);
*/
  // Once we’ve got the initialization vector, we can decrypt the file.
	await new Promise(async (resolve) => {
		console.log("In Decrypt promise");
		//readInitVect.on('close', async () => {
			let cipherKey = key; //await pbkdf2Prom(password, "salt", 5000, 32, "sha512"); // TODO, need real salt
			//const cipherKey = getCipherKey(password);
			//const readStream = fs.createReadStream(file, { start: 16 });
			const readStream = fs.createReadStream(file);
			const decipher = crypto.createDecipheriv('aes256', cipherKey, iv); //initVect);
			//const unzip = zlib.createUnzip();
			const writeStream = fs.createWriteStream(file + '.unenc');
		try {
			console.log("decrypting...");
			await new Promise(resolve =>
				readStream
				  .pipe(decipher)
				  //.pipe(unzip)
				  .pipe(writeStream).on("finish", resolve));
		} catch(err) {
			console.log("At decrypt try/catch with error: ", err);
			throw err;
		}
			})
	//  );
};

class PrependHeader extends Transform {
  constructor(header, options) {
    super(options);
    this.header = header;
    this.done = false;
  }

  _transform(chunk, encoding, callback) {
    if (!this.done) {
		console.log("In PrependHeader, encoding is: ", encoding, ", len of header is: ", this.header.length);
		this.push(Buffer.concat([this.header, chunk]));
		this.done = true;
    }
    this.push(chunk);
    callback();
  }
}
/**
 * @desc Copies a file from one location to another using streams. Will overwrite
 * @param {string} path - file to be moved.
 * @param {string} newPath - new location for file.
 * @param {string} flags - passed to createWriteStream for new file, defaults to 'w'.
 * @private 
*/
const pipeFile = async function (path, newPath, flags, isOverwrite=false, encryptPw=null) {
	if (!isOverwrite && await accessFile(newPath, fs.constants.F_OK)) {
		return false;
	}
	console.log("In pipeFile for: ", path, newPath);
	let readStream;
	if (encryptPw) {
		encryptPw = 'A0B0C0D0E0F001020304050607080900'; //TODO
		//const iv = crypto.randomBytes(16);
		const iv = Buffer.alloc(16);
		crypto.randomFillSync(iv, 0, 16);
		const header = " - @flylow/gwlogger - " + iv + "ENDGWLHEADER"; // 50 bytes
		const addHeader = new PrependHeader(iv);
		tempHeaderDec = iv;
		console.log("In pipFile, iv is: ", iv.toString('hex'));
		let key = await pbkdf2Prom(encryptPw, "salt", 5000, 32, "sha512"); // TODO, need real salt
		console.log("In pipFile, key is: ", key.toString('hex'));
		const encryptor = crypto.createCipheriv('aes-256-ctr', key, iv);
		const decryptor = crypto.createDecipheriv('aes-256-ctr', key, iv); 
		
		//const readStream = createReadStream(path);	
		const encStream = createWriteStream(newPath + ".enc");
	const dencStream = createWriteStream(newPath + ".unenc");
		await new Promise(resolve =>
			createReadStream(path).pipe(encryptor)
				//.pipe(addHeader)
				.pipe(encStream)
				.on("finish", resolve));
		//await decrypt(newPath + ".enc", encryptPw, key, iv);
			
		await new Promise(resolve =>
			createReadStream(newPath + ".enc").pipe(decryptor).pipe(dencStream).on("finish", resolve));	
		return true;
		
	} else {
		readStream = createReadStream(path);
		const writeStream = createWriteStream(newPath, {flags});
		await new Promise(resolve => 	
			readStream.pipe(writeStream).on("finish", resolve));
		return true;
	}
};

/**
 * @desc Copies a file from one location to another using node.js 'copyFile'
 * @param {string} path - file to be moved.
 * @param {string} newPath - new location for file.
 * @param {string} isOverwrite -can specify to overwrite target or not
 * @param {string} encryptPw - encryption password, if null no encryption
 * @private 
*/
const copyFile = async function (path, newPath, flags=null, isOverwrite=false, encryptPw=null) {
	let mode = (isOverwrite)
		? null
		: fs.constants.COPYFILE_EXCL;
	try {
		console.log("encrypt is: ", (encryptPw));
		if (encryptPw) {
			return await pipeFile(path, newPath, flags, isOverwrite, encryptPw);
		} else {
			//return await pipeFile(path, newPath, flags, isOverwrite, encryptPw);
			await copyFileProm(path, newPath, mode);
			return true;
		}
	} catch(err) {
		if (err.code === "EEXIST") return false;
		console.log("Error in copyFile is: ", err); // TODO
		return false;
	}
};

/**
 * @desc Copies a file from one location to another, compressing the file along the way.
 * @param {string} path - file to be moved.
 * @param {string} newPath - new location for file.
 * @param {string} flags - passed to createWriteStream for new file, defaults to 'w'.
 * @param {string} isOverwrite -can specify to overwrite target or not
 * @param {string} encryptPw - encryption password, if null no encryption 
 * @private 
*/
const zipFile = async function (path, newPath, flags, isOverwrite=false, encryptPw=null) {
	if (!isOverwrite && await accessFile(newPath, fs.constants.F_OK)) {
		return false;
	}
	const readStream = createReadStream(path);
	const writeStream = createWriteStream(newPath, {flags});
	await new Promise(resolve => 	
		readStream.pipe(zlib.createGzip()).pipe(writeStream).on("finish", resolve));
	return true;
};

const copyDir = async function (src, dest, overwrite=false, isZip=false, encryptPw=null, depth=Number.MAX_SAFE_INTEGER) {
    const entries = await readdirProm(src, {withFileTypes: true});
	if (!await accessFile(dest)) {
		await mkdirProm(dest);
	}
    for(let entry of entries) { 
        const srcPath = pathpath.join(src, entry.name);
        const destPath = pathpath.join(dest, entry.name);
        if(entry.isDirectory()) {
			if (depth > 0) {
				await copyDir(srcPath, destPath, isZip, --depth);
			}
        } else {
			console.log("srcPath is: ", srcPath);
			if (isZip) {
				await zipFile(srcPath, destPath+".gzip");
			} else {
				console.log(await copyFile(srcPath, destPath, null, overwrite, encryptPw));
			}
        }
    }
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
exports.copyDir = copyDir;
exports.truncFile = truncFile;
exports.unlinkFile = unlinkFile;
exports.accessFile = accessFile;
exports.utimesProm = utimesProm;
exports.readdirProm = readdirProm;
exports.mkdirProm = mkdirProm;
exports.touchFile = touchFile;
exports.touchFileSync = touchFileSync;
exports.getVersion = getVersion;

