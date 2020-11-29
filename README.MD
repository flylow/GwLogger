# GwLogger #
GwLogger aspires to be a flexible, no-hassle logger for NodeJS which logs to file and console/stdout, and supports rolling logs and/or compressed archives. It has zero dependencies.

GwLogger requires Node.js, version 10.0 or greater.

## Feature Releases ##
|Release   |Date| Summary  |
| ------------ | -- | ------------ |
| 1.0.0 | 2020-08-09 | Initial Release |
| 1.1.0 | 2020-09-21 | Added rolling logs (by size) and multiple profile support |
| 1.2.0 | 2020-10-01 | Added rolling logs (at startup) |
| 1.3.0 | 2020-11-25 | Added isColor for console/stdout logging. Added setSepCharFile and setSepCharConsole to aid the importing of logfiles into databases. Added isRollAsArchive to save compressed logfiles at the end of the rolling logs pipeline.|
| 1.4.0 | 2020-11-29 | Added ability to specify archiveLogPath separately from rolledLogPath.  Made changes so that no error occurs if rolledLogPath and/or archiveLogPath is not defined (archiveLogPath would use rolledLogPath, and rolledLogPath would use the logfile\'s path. |

(Please see CHANGELOG.MD for more minor release/fix descriptions)

## Install or Update ##
Install or update locally from your project\'s main directory into the node_modules directory via NPM:
```javascript
	npm i @flylow/gwlogger

```
## Usage ##
To use, require GwLogger in source files and create your logger with: 

```javascript
	const GwLogger = require("@flylow/gwlogger").GwLogger; 
	const log = new GwLogger("WARN"); // loglevel is "warn", will log to "./gwl_log.log"
```

Or, if your application is using ES Modules:
```javascript
	import gwl from "@flylow/gwlogger/GwLogger.js"; 
	const GwLogger = gwl.GwLogger;
	const log = new GwLogger("WARN"); // loglevel is "warn", will log to "./gwl_log.log"
```
The logger above would be created at WARN level, log to file, not to console, and create the default ./gwl_log.log logfile in your current application's working directory.

You can create multiple loggers in your application (or even in one source file), all at different loglevels/settings using the same logfile or different logfiles.

Now that you have a logger defined, you can log something:
```javascript
	log.warn("Did this warning get logged?");
```

**05-13T21:08:39:027 WARN: Did this warning get logged?**
The line from your logfile shows the result. Obviously, this warning was logged on May 13th at 9:08pm, plus 39 seconds and 27 milliseconds.

#### Example Use ####
Here is a **minimal application** that uses the API to define a logger to log at both console and file at "INFO" level, will roll logfiles around 200K and keep the last five logfiles, will compress and save rolled logfiles older than those five.
```javascript
	const GwLogger = require("@flylow/gwlogger").GwLogger; 
	const log = new GwLogger("INFO", true, true);
	log.setMaxLogSizeKb(200);
	log.setMaxNumRollingLogs(5);
	log.setIsRollBySize(true);
	log.setIsRollAsArchive(true);
	log.info("Wait, is that all there is to it?");
	
```
To run, create an app directory and copy the above code into it with any file name, say example1.js. Then, from a terminal window navigate to that app directory and install GwLogger as a module:
`npm i @flylow/gwlogger`
Then you can run the example:
`node example1.js`
You should see: INFO: Wait, is that all there is to it?
and you will find gwl_log.log in your app directory with the same log item.

Settings can be changed via profiles, environment variables or the API. For example the loglevel can be adjusted anytime in your source by this API call:
```javascript
	log.setLogLevel("debug");
```
Logging to console or logfile can be similarly controlled:
```javascript
	log.setIsConsole(true); // turn-on logging to console/stdout
	log.setIsFile(false); // turn-off logging to logfile
```

A different path for rolling logs can be defined this way:

```javascript
	log.setRollingLogPath("./logfiles/rollingLogs");
```

### Constructors ###
There are currently two constructors, the first if you choose not to create a JSON profile or to override parts of that profile (or environment variables), and a second that loads a JSON file of your choice. You can further modify settings in either case with the API.

#### GwLogger(loglevel, isConsole, isFile, fileName) ####
Where:
* loglevel is a case-insensitive string, one of: off, fatal, error, notice, info, dev, debug, trace, or all. The default is off;
* isConsole is a boolean and indicates logging should be displayed on console (sent to stdout). The default is false;
* isFile is a boolean and indicates logging should be written to a logfile. If false, no file will be created or appended unless later set to true. the default is true;
* fileName is a string and is the name of a logging path and logfile. If it does not exist it will be created. The path can be relative (based on the current working directory) or absolute. If the directory does not exist, an error will be thrown. The default is "./gwl_log.log\".

Sample Uses:
```javascript
	// use built-in defaults:
	const log = new GwLogger();
	// log at INFO level to console, turn off logging to file:
	const log = new GwLogger("info", true, false);
	// log at info level to console and mylogfile:
	const log = new GwLogger("info", true, true, "./logfiles/mylogfile.log");
``` 

`let log = new GwLogger("DEBUG", true, false);`  creates a logger at debug level, and adds logging-to-console, but turns off logging to file. The following statment in your source:`log.debug("Did this debug detail get logged?");` would result in an item like this on the console:
**DEBUG: Did this debug detail get logged?**

By built-in default, logging is to a file named "./gwl_log.log" in your apps current  working directory. This generally means the directory where myapp.js lives when you type \'node myapp.js\'. There are several ways to specify a different location/name for the logfile, such as using a profile file, an environment variable, or specifying the path when creating a new logger. 

Here are a couple of other examples of logger initialization, the first of which logs to both console and file at the "info" log level:

`const log = new GwLogger("info", true, true);` // logs to console and the default log file
`const log = new GwLogger("info", false, true, "./logger/logger.log");` // does not log to console

The last construction above overrides the default logfile location for this specific logger.

The supported log levels are: OFF, FATAL, ERROR, WARN, NOTICE, INFO, DEV, DEBUG, TRACE, and ALL. Change the log level for any logger instance at any time in your source by calling (for example): `log.setLogLevel("info");`

You can also turn logging on/off to the console or logfile separately at runtime with  `log.setIsConsole(`\<boolean>`)`; and, `log.setIsFile(`\<boolean>`);`

The above is about all you\'ll usually need for many NodeJS projects.

Some settings can only be specified at runtime via the API. For instance, the module\'s name (or other short descriptor) can be added near the beginning of each logged statement by adding this in your source code: `log.setModule("myMain");` Timestamps can be added to console output (they always appear in logfiles) by using: `log.setIsConsoleTs(true);` Those two statements would result in:
**05-13T21:08:39:027 DEBUG myMain: Did this debug detail get logged?**

#### GwLogger(profile_object) ####
In this constructor, profile_object contains an attribute profileFn with string value pointing to a file to use for this logger\'s JSON profile. Profiles are described in the next section. If specified, this profile would override an optional GwLogger.json profile (but does not override environment variables).

Sample use:
```javascript
	const log = new GwLogger({profileFn: "./profiles/myprofile.json"}});
```

## Profile or Environment Variables
A common way to specify the logfile name and other logging parameters is to create a logging profile -- a small json file, which can be shared by all loggers by default. Or, a unique json file can be used as described in the second constructor just above.

By default at startup, each instance of GwLogger checks for environment variables (described later), but if none are found looks in the same directory as the initiating application for an optional JSON profile. This general profile, if used must be named \"GwLogger.json\". Any specified setting in the file will override the built-in default setting for that attribute, but only the attributes shown in the example below will be recognized. This example also documents the built-in defaults if no profile is specified.
 
##### Example of GwLogger.json using built-in default values, #####
```json
  {
	"fn": "./gwl_log.log",
	"logLevelStr": "off",
	"isConsole": false,
	"isFile": true,
	"isEpoch": false,
	"nYr": 0,
	"isLocalTz": true,
	"isShowMs": true,
	"isRollAsArchive": false,
	"isRollAtStartup": false,
	"isRollBySize": false,
	"rollingLogPath": null,
	"archiveLogPath": null,
	"maxLogSizeKb": 0,
	"maxNumRollingLogs": 0
  }
```

If found, all instances of GwLogger for your application will use the ./GwLogger.json profile you created to override built-in default values, unless a different profile is specified in the constructor or environment variables are found. 
  
If you prefer (or are required by your runtime environment) to store the profile as a group of environment variables, then each attribute name shown above in the json listing should be preceded by "GWL_" so that GwLogger can find them. Such as:
```shell
	GWL_fn=./logfiles/mylogfile.txt
	GWL_isConsole=true
	GWL_nYr=4
```
Note that if **any** GwLogger environment variable is discovered, then **all** json profiles and settings will be ignored.

You\'ll set environment variables in an [operating-system-specific](https://en.wikipedia.org/wiki/Environment_variable "operating-system-specific") way, or maybe use [dotenv](https://github.com/motdotla/dotenv "dotenv").  
Any values that are not set by the shared GwLogger.json profile, another json file you specify in the constructor, or in the environment variables will be initialy set according to the built-in defaults.

To write to a different log file than the built-in defaults, the environment variables, or the ./GwLogger.json file specify, pass a new name into a constructor as the fourth parameter, and the others will be overridden: 
`const log = new GwLogger("TRACE", true, true, "mylogdir/mylog.log");` 
In any case, make certain that the directory already exists, GwLogger will create the file but not the directory.

### Log Levels 
A note about GwLogger log levels: The default is OFF, but log levels can be specified at almost any time, either with the GwLogger.json profile, environment variables, at assignment time as with log = new GwLogger(\"debug\"), or at run time with log.setLogLevel(\"info\"). As with other loggers, logging will occur for any log statement at, or higher, than the currently set log level. Here are the log levels supported by GwLogger:

*	OFF=Does not log *Anything*. This benefits some build tools, and is the built-in default.
*	FATAL=Rarely used. The outlook is bleak, stuff is broken! Wake someone up now, the business depends on the code running! 
*	ERROR=Serious prob, going to try to continue, but will likely crash or run suboptimal quality and/or performance.
*	WARN=something unexpected happened, suprisingly we\'re still okay. This needs to be investigated, but it seems things can keep running.
*	NOTICE=The user may need to do something, (like renew a subscription, backup a DB), other normal business. This is the highest logging level that the business or an end-user would usually care about.
*	INFO=Nothing too important, but interesting process measurements, or just heartbeat-type info. More dev-oriented than business.
*	DEV=DebugLite, or DebugTmp. Use for short periods of intense bug hunting and, well, development. This is a non-standard log level.
*	DEBUG=more detail than INFO. More long-term than DEV.
*	TRACE=debug plus excruciating amount of additional detail, like values inside loops, or colliding spawned processes. Call home, tell them you\'ll be late.
*	ALL=currently same as trace. Included for compatibility\'s sake.

Log levels are used in two ways: To set the current logging level and in logging statements. All the above except OFF and ALL may be used in logging statements, but lower-case only.

### Timestamp formats #####
Timestamp formats are based on ISO-8601, although that can be tweaked with the profile or environment variables, and at runtime. For instance, you can specify the number of year digits, whether to include milliseconds, or local vs. UTC time.

Besides ISO-8601, you can specify to show timestamps in only milliseconds since 1/1/1970 UTC (aka the Unix Epoch).

Most timestamp formating is done using the API (described later), but these four settings can be included in a profile or as environment variables:
```json
  {
	"isEpoch": false,
	"nYr": 0,
	"isLocalTz": true,
	"isShowMs": true,
  }
```
isEpoch switches the format to simple milliseconds (MS, the Unix Epoch), nYr is number of digits for year to use in timestamps, isLocalTz switches between UTC and local time, and isShowMs turns on/off the display of MS when logging to console. Timestamps always appear in logfiles.

## Rolling Logs and Archives ##

Rolling logs help you manage your old logfiles. GwLogger supports rolling by saving the n most recent logfiles by size and/or at every application startup. After n logfiles have been rolled, the oldest is deleted to make room for the newest. GwLogger can, instead, compress and archive every logfile. Finally, it can roll n logfiles as human-readable, then compress and archive the oldest rather than deleting it. This last situation allows easy access and maintenance, while still saving disk space for storage.

#### Rolling Logs by Size
When your logfile reaches a specified size, it is copied/renamed and logging continues with an empty logfile. There are four parameters to define: 

1. isRollBySize, 
2. maxLogSizeKb, 
3. maxNumRollingLogs, and 
4. rollingLogPath. 

Note that the rollingLogPath must point to a directory that already exists, and if not set rolling will be to the logfile\'s directory.

The four parameters may be defined in your JSON profile, environment variables, or you can manipulate rolling logs by size via the API. The rolled logs are named with the logger\'s logfile name with "_nnn" appended, such as gwl_log_001.log, gwl_log_002.log, ..., gwl_log_nnn.log. The larger numbers will contain the older data.

Note that the first three parameters above must be defined.

#### Rolling Logs at Startup
Three parameters ccan be defined to use rolling logs at startup: 

1. isRollAtStartup, 
2. maxNumRollingLogs, and 
3. rollingLogPath. 

Note that the rollingLogPath, as mentioned earlier, must point to a directory that already exists, and if not set rolling will be to the logfile\'s directory.

The three parameters are usually defined either in your JSON profile or the environment variables prior to starting your application. You can use both roll-by-size and roll-at-startup together.
<a name="cheatRollAtStart"></a>

##### Rolling Logs at Startup via the API
Although this feature is probably best set either by an environment variable or by a json profile, it is possible to enable it via the API. If, at startup, logLevel is set to OFF or the isFile parameter is set to false, rolling will be delayed until those parameters are changed via the API and logging to file actually commences. For instance:

```javascript
	const logger = new GwLogger("OFF", false, true, "./logfiles/mylogfile.log");
	logger.setMaxNumRollingLogs(5);
	logger.setRollingLogPath("./rolledfiles");
	logger.setIsRollAtStartup(true);
	logger.setLogLevel("debug"); // This change will cause logfile to roll.

```
However, if you have multiple source files writing to the same logfile, you\'ll have to good at predicting which one Node will start first, which can be difficult. That\'s why it is better to use a profile for roll at startup.
<a name="archives"></a>

#### Archives 
Using the isRollAsArchive option extends the logfile pipline one more step. Rather than delete the oldest rolled log, setting the archival style causes it to be compressed, renamed with a UTC timestamp and never removed by GwLogger. The logfile, \"happy.log\" could be:
- archived directly to \"happy_2020-11-18T153057Z.log.gz\" when your app is started or reaches a certain size. Or, 
- rolled first to a numbered plain text rolled file, and as the maxNumberRollingLogs was exceeded to  \"happy_2020-11-18T153057Z.log.gz\" as a compressed archive. 

With maxNumRollingLogs=5 you could see a combined rolled and archive files directory after the 11th rolling that is similar to:

![Rolling Archives](https://raw.githubusercontent.com/flylow/GwLogger/master/docimages/dirlisting.png "Rolling Archives")

Archived files are compressed into [gzip](https://www.gnu.org/software/gzip/ "gzip") format, which can be opened with [7-Zip](https://www.7-zip.org/ "7-Zip") or [Winzip](https://www.winzip.com/win/en/ "Winzip") on Windows, or from Linux/Mac command lines with "gzip -dk \<fn\>\".

Archiving, if enabled, is always used with isRollAtStartup and/or isRollBySize. As part of your json profile, for example:

```json
	"fn": "./logfiles/happy.log",
	"logLevelStr": "info",
	"rollingLogPath": "./rolledFiles",
	"archiveLogPath": "./archives"
	"isRollAsArchive": true,
	"isRollAtStartup": true, 
	"isRollBySize": true,
	"maxLogSizeKb": 50, 
	"maxNumRollingLogs": 5
```
or, via the API:
```javascript
	const log = new GwLogger("off", false, true, "./logfiles/happy.log");
	log.setMaxLogSizeKb(50);
	log.setRollingLogPath("./logfiles/rolledfiles");
	log.setArchiveLogPath("./logfiles/archives");
	log.setMaxNumRollingLogs(5);
	log.setIsRollBySize(true);
	log.setIsRollAsArchive(true);
	log.setLogLevel("info");

Setting maxNumRollingLogs to zero means that a logfile will be immediately compressed (when hitting the max size or at startup) and saved as an archive file. Settings as shown above get you the best of both worlds, some recently rolled files for direct examination and older files saved as compressed archives. If the archiveLogPath is not set, archives will be stored in the same directory used for rollingLogPath.
```

### GwLogger\'s Application Programming Interface (API)
The API contains a list of public methods for each logger accessed as in the earlier examples: `log.<apiCall()>.` Settings that can also be specified in a JSON/environment profile are marked with an '*\'. Environment variable names are given, when applicable. API methods will override profile/environment settings, and profile/environment settings will override built-in defaults. If any GwLogger environment variable is found, JSON profile files are ignored.

| General  | Description and Default Value |
| -----------| ------------ |
|*setLogLevel(logLevelStr); | Switches to specified log level. logLevelStr is a case-insensitive string, one of: off, fatal, error, notice, info, dev, debug, trace, or all. The default is "OFF". Environment variable: "GWL_logLevelStr"=`<logLevelStr>`.|
|getLogLevel(); | Returns the current log level.
*setIsConsole(b); | If b is true, will allow logging to console. If false, no logging is done to console. Default is false, no logging to console. "GWL_isConsole=\"\<boolean> |
|getIsConsole(); | Returns boolean true/false|
|*setIsFile(b); |  If b is true, will allow logging to file from this time forward. If false, no logging is done to file. Default is true, log to file. If initially set to false, no file will be created or appended unless later set to true. Environment variable: "GWL_isFile=\"\<boolean>.|
|getIsFile(); | Returns boolean true/false.|
|getFn(); | Returns a string with the path and name of the current logfile. Note that the path and name cannot be set from the API, but must be defined in the constructor, in an environment variable, or in a JSON profile file.|
|  getVersion(); |   Returns the version number of your current installation of GwLogger. |

| Formatting  | Description and Default Value |
| -----------| ------------ |
|setModuleName(name); | Optionally tags this logger with the module name, so it can display on each log item. Useful when you have many source files logging into the same file, which is often the case. Helps pin the blame. You could use any text you want as 'name\'. `log.setModuleName("MyModule");  // would show our debug sample statement like this:` **07-13T21:28:00 DEBUG MyModule: Did this debug detail get logged?** There is no default module Name;|
|getModuleName(); | Returns the module name set for this logger, or null if none set.| 
|*setIsEpoch(b); | Timestamp modifier. If boolean is true, then timestamp will be milliseconds since 1/1/1970 (UNIX Epoch). If this is set to true, then other timestamp modifiers (timezone, year-digits, show milliseconds) will be ignored. Default is false. Environment variable: "GWL_isEpoch=\"\<boolean>.|
|getIsEpoch(); | Returns boolean true/false.|
|*setIsLocalTz(b); |Timestamp modifier. If boolean is true, timestamps will be in local time. If false, times will be UTC. Default is true. Environment variable: "GWL_isLocalTz=\"\<boolean>.|
|getIsLocalTz(); | Returns true/false boolean value.|
|*setYearDigits(n); | Timestamp modifier. Sets the number of timestamp digits to use for year. Must be 0 through 4. Default is 0, do not show year digits. Environment variable: "GWL_nYr=\"`<0 ... 4>`.|
|getYearDigits(); | Returns the number of digits for printing the year in a timestamp.
*setIsShowMs(b); | Timestamp modifier. If boolean is true, will include milliseconds as part of normal timestamp. Default is true, show milliseconds. Environment variable: "GWL_isShowMs=\"\<boolean>.|
|getIsShowMs(); | Returns boolean true/false.|
|setIsColor(b); | Controls coloring of console/stdout logging. if boolean is false no color will be applied to logging statements. Primarily benefits stdout use cases involving redirection to another system or application. Default is true.|
|getIsColor(); | Returns boolean true/false.|
|setIsConsoleTs(b); | If boolean is true, will show timestamps on console logs. Default is false.|
|getIsConsoleTs(); | Returns boolean true/false.|
|setDepthNum(n); | n is an integer or null. Sets the depth level for logging object contents. Default n is 2 (same as console.log). Use null to print all levels.|
|getDepthNum(); | Returns a number.|
|setSepCharFile(string); | Use a character, or even a string, to separate portions of log statements (timestamp, loglevel, moduleName, and message). Primarily benefits those wishing to import or parse logfiles into databases. Default separator is a space character, " ".|
|getSepCharFile(); | Returns the current separation character for logfiles. |
|setSepCharConsole(string); | Same as setSepCharFile above, but applies to console/stdout log statements.|
|getSepCharConsole(); | Returns the current separation character string for console/stdout.|

| Rolling Logs and Archives  | Description and Default Value |
| -----------| ------------ |
|*setRollingLogPath(path); | Defines the directory where older rolled logs should be saved. The default is null, but if not specified will use the logfile directory. When specified directory must exist. Environment variable: \"GWL_rollingLogPath=\"\<string> |
|getRollingLogPath(); |Return a string with path. |
|*setMaxNumRollingLogs(n); |The maxiumun number of old logs to save. Defaults to 0, n must range between 0-20. Environment variable: \"GWL_maxNumRollingLogs=\"\<0..20> |
|getMaxNumRollingLogs(); |Returns a number |
|*setMaxLogSizeKb(k);|How large the logfile can become before GwLogger attempts to roll it. k must be an integer representing kilobytes. So, if setMaxLogSizeKb(2000), then GwLogger will start the rolling process when the logfile size is 2MB. Environment variable: \"GWL_maxLogSizeKb=\"\<boolean>|
|getMaxLogSizeKb(); |Returns a number |
|*setIsRollBySize(b); |If b=true, will attempt to turn on rolling logs. Must be the last setting for roll files, because other roll setting changes via the API will automatically set this to false. Environment variable: \"GWL_isRollBySize=\"\<boolean>|
|getIsRollBySize(); |Return boolean true/false. |
|*setIsRollAtStartup(b); |  This variable is best set either by an environment variable ("GWL_isRollAtStartup=\"\<boolean>) or in the json profile. However, if a GwLogger is created at OFF level and/or with isFile=false (so that logging-to-file is not enabled), then setIsRollAtStartup can be set via the API. See the section "[Rolling Logs at Startup](#cheatRollAtStart "Rolling Logs at Startup")".  |
|getIsRollAtStartup(); |Return boolean true/false. |
|*setIsRollAsArchive(b); | A modifier for rolling logs if boolean is true. Instead of continuous rolling of older log files, save them by including a timestamp in filenames, compressing them, then never removing them. Environment variable: \"GWL_isRollAsArchive=\"\<boolean>. See the section [Archives](#archives "Archives")|
|getIsRollAsArchive(); |Return boolean true/false. |
|*setArchiveLogPath(path); | Defines the directory where archived logs should be saved. The default is null, but if not specified will use the rolledLogPath directory. When specified, the directory must exist. Environment variable: \"GWL_archiveLogPath=\"\<string> |
|getArchiveLogPath(); |Return a string with path. |

Of course, most log levels (except off and all) are API methods and also part of the API: fatal, error, warn, notice, dev, debug, and trace. They must be lower-case and use the form:
log.`<level>`(`<data to log>`). You may also comma-separate data items:
`log.dev("Value of object vehicle is: ", vehicle);`

### GwLogger Developer and Tester Notes ###
Test directories and files are not included in the NPM releases, but can be found on GitHub. In the test directory, see the file \"DescriptionOfTests.txt\".

### Bugs or Problems ###
 If you find a bug or usability problem, please open an [issue](https://github.com/flylow/GwLogger/issues?q=is%3Aopen+is%3Aissue "issue").

MIT license.

--G. Wilson, 11/2020
