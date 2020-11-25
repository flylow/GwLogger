"use strict";
/* global exports */
/*
	Format object description:
		tsFormat.isEpoch // boolean, TS in MS - Unix Epoch?
		tsFormat.isLocalTz // boolean, local timezone?
		tsFormat.isShowMs  // boolean, include MS?
		tsFormat.nYr // integer 0-4, # of yr digits to include
		tsFormat.sephhmmss // string, separator for hh:mm:ss
		
		cTime, milliseconds to use as current time for creating a Timestamp.
*/
		
const getTimeStamp = function(tsFormat, cTime=null) {
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
};
	
exports.getTimeStamp = getTimeStamp;	