"use strict";
/* global exports */

/**
 * @overview 
 * Handle time, or at least format it for logging.
 *
 * All functions herein are only used internally. Methods and objects 
 * may change their form, function, or be removed. 
*/


const version = "1.5.4";


/**
 * @class
 * @desc Formats timestamps.
 * @private
*/
class Timestamps {
	/** 
	 * @returns {string} Current version for test instrumentation.
	 * @private 
	*/
	getVersion() {
		return version;
	}

	/**
	 * @desc Returns a formatted timestamp according to specified parameters.
	 * @param {object} tsFormat - An object containing the format options. 
	 * @param {boolean} tsFormat.isEpoch - Timestamps in milliseconds, the 
	 * Unix Epoch. Other params ignored if this is true.
	 * @param {boolean} tsFormat.isLocalTz - local timezone if true, else UTC.
	 * @param {boolean} tsFormat.isShowMs - include milliseconds in timestamp.
	 * @param {number} tsFormat.nYr - integer 0-4, # of yr digits to include.
	 * @param {string} tsFormat.sephhmmss - separator for hh:mm:ss, normally a colon ':'.
	 * @param {number} cTime - milliseconds to use as current time for creating a Timestamp.
	 * @private
	*/
	getTimeStamp(tsFormat, cTime=null) {
		if (tsFormat.isEpoch) return Date.now(); //UNIX Epoch
		
		let currentTime = (cTime)
			? new Date(cTime)
			: new Date();
			
		if (!tsFormat.isLocalTz && tsFormat.sephhmmss === ":"
				&& tsFormat.nYr === 4 && tsFormat.isShowMs) {
			//2020-07-10T20:56:33.291Z (24 chars)
			return currentTime.toISOString();
		}
		
		const padZero = "0";	
		let yr = tsFormat.isLocalTz 
			? (currentTime.getFullYear()).toString() 
			: (currentTime.getUTCFullYear()).toString();
		
		let month = tsFormat.isLocalTz 
			? (currentTime.getMonth() + 1).toString() 
			: (currentTime.getUTCMonth() + 1).toString();
		month = month.padStart(2, padZero);

		let dayOfMonth = tsFormat.isLocalTz 
			? currentTime.getDate().toString() 
			: currentTime.getUTCDate().toString();
		dayOfMonth = dayOfMonth.toString().padStart(2, padZero);

		let hours = tsFormat.isLocalTz 
			? currentTime.getHours().toString() 
			: currentTime.getUTCHours().toString();
		hours = hours.padStart(2, padZero); 
		
		let minutes = tsFormat.isLocalTz 
			? currentTime.getMinutes().toString() 
			: currentTime.getUTCMinutes().toString();
		minutes = minutes.padStart(2, padZero);
		
		let seconds = tsFormat.isLocalTz 
			? currentTime.getSeconds().toString() 
			: currentTime.getUTCSeconds().toString();
		seconds = seconds.padStart(2, padZero);
		
		let ms = "";
		if (tsFormat.isShowMs) {
			ms = tsFormat.isLocalTz 
				? currentTime.getMilliseconds().toString() 
				: currentTime.getUTCMilliseconds().toString();
			ms = ms.padStart(3, padZero);
			ms = "." + ms;
		}

		if (tsFormat.nYr === 0) yr = ""; // omit year
			else if (tsFormat.nYr < 4) yr = yr.substring(4 - tsFormat.nYr) + "-";
			else yr = yr + "-"; // 4 digit
		
		let tz = tsFormat.isLocalTz 
			? "" 
			: "Z";
		
		return (yr + month + "-" + dayOfMonth + "T" + hours 
			+ tsFormat.sephhmmss + minutes + tsFormat.sephhmmss + seconds + ms + tz); 
	}
}

//exports.getTimeStamp = getTimeStamp;
//exports.getVersion = getVersion;
exports.Timestamps = Timestamps;