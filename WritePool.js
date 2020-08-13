/**
 * WritePool class creates new writeStreams, and then keeps a pool of them for the application.
 * It helps ensure that any of the user's apps loggers with the same logfile name will write
 * to the same writeStream rather than creating another one on a different buffer.
 *
*/


/*
import { createWriteStream } from "fs";
*/
const createWriteStream = require("fs").createWriteStream;
const watch = require("fs").watch;
const existsSync = require("fs").existsSync;
const fs = require("fs");
let customStreams = {};

doRegisteredStream = function(fn, replace=false) {
	let ws;
	let record;
	let ucFn = fn.replace(/\s+/g, '').toUpperCase();
	record = customStreams[ucFn];
	if (record && record.ws && !replace) {
		return ws;
	}
	if (replace) { 
		console.log("################# replacing writeStream for ", fn); 
	}
	if (replace && record) {
		try {
			if (record.watcher) {
				record.watcher.close(); // todo, should this close after the fd?
				record.watcher = null;
			}
			if (record.ws) record.ws.end();
		}
		catch(err) {
			console.error("Error closing record.watcher or ending stream for fn: ", fn, ", error is: ", err);
		}
	}
	
	if (replace && record && record.fd) {
		record.fd = null;
	}

	customStreams[ucFn] = {}; // clean slate for record
	ws = writePool.createCustomWriter(fn); // creates a new stream, and re-creates the logfile
	customStreams[ucFn].ws = ws;
	if (replace) { 
		//console.log("replaced ws for ", ucFn);
	}
	//console.log("doRegisteredStream done with: ",  ucFn, customStreams[ucFn].ws.path);
	return ws;		
}

updateRecord = function(fn, nuBits) {
	let record;
	let ucFn = fn.toUpperCase();
	record = customStreams[ucFn];	
	if (!record) return null;
	record = {...record, ...nuBits};
	customStreams[ucFn] = record;
	return record;
	
}

/*global console, require */ // A directive for exceptions to ESLint no-init rule
class WritePool {
	
	constructor () {
		this.profileWriter; // profile or default writeStream
	}

	createCustomWriter(fn) {
		let ws;
		// Make sure the file exists, or the lazy stream create process may not beat other dependencies (watcher)
		if (!existsSync(fn)) {
			fs.closeSync(fs.openSync(fn, 'w'));	
		}			
		try {
			let watcher;
			ws = createWriteStream(fn, {flags: "a", autoclose: true, emitClose: true});
			ws.on("error", (err) => {
				console.error("WritePool log writer stream error :", err); // Attempt to put error on console, try to keep running...
			});	
			ws.on("drain", () => {
				 console.log("Logging can be resumed now...");
			});	
			ws.on("open", (fd) => {
				updateRecord(fn, {fd: fd} );
				//console.log("----------------- WriteStream for:",fn, " was opened ----------------", fd);
			});
			ws.on("close", () => {
				//console.log(" +++++++++++++++++  close event detected on ws.path = ", ws.path );
			});
			ws.on("ready", () => {
				//console.log(" +++++++++++++++++  ready event detected on ws.path = ", ws.path );
			});	
			
			ws.write("New Custom Stream for file " + fn + " created in WritePool at " + new Date() + "\n");	
			try {
				watcher = watch(fn, (eventType, filename) => { 
				  console.log("\nThe file", filename, "was modified! fn is: ", fn); 
				  console.log("The type of change was:", eventType); 
				  let exists = existsSync(fn);
				  console.log("existsSync for ", filename, " is: ", exists);
				  if (!exists) {
					doRegisteredStream(fn, true);
				  }
				});
			}
			catch(err) {
				console.log("ignoring error in watch setup: ", err);
			}
			watcher.unref(); // don't hold up program exist if a watched event fires
			updateRecord(fn, {watcher: watcher});
			return ws;
		} catch(err) {
			console.error("In GwLogger's WritePool.js", err);
		}
	}
	
	// Will return a previously registered stream for filename, or have a new one created
	registeredStream(fn, replace=false) {
		return doRegisteredStream(fn, replace);
	}
	
	// Writes to the logfile
	write(ucFn, txt) {
		const ws = customStreams[ucFn].ws;
		let bufferOk;
		try {
			bufferOk = ws.write(txt, "utf8");
			return bufferOk;
		} catch(err) {
			console.error("ERROR in GwLogger.WritePool.write: ",err);
			throw err;
		}
	}

}



const writePool = new WritePool();

/*
export { writePool }; // for ES6 Modules
*/

module.exports = writePool;

