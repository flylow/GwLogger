# GwLogger #
GwLogger aspires to be a straight-forward, no-hassle logger for NodeJS which logs to file and/or console. It has zero dependencies.

GwLogger requires Node.js, version 8.0 or greater. It does not support browser development.

## Installation ##
Install locally from your project\'s main directory into the node_modules directory via NPM:
`npm i @flylow/gwlogger`
or globally:
`npm i -g @flylow/gwlogger`

The global installation may require some changes in your configuration and how you access GwLogger. NodeJS documentation now states: "It is strongly encouraged to place dependencies in the local node_modules folder;" see: https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders.

The examples below always assume GwLogger was installed locally to your application.

## Usage ##
To use, import/require GwLogger in source files and create your logger with: 

```javascript
const GwLogger = require("./node_modules/@flylow/gwlogger").GwLogger; 
const log = new GwLogger("WARN"); /* creates a logger at WARN level, logs to file, not to console, and creates ./gwl_log.log logfile in your current application's working directory. */
```
Or, if your application is using ES Modules:
```javascript
import gwl from "./node_modules/@flylow/gwlogger/GwLogger.js"; 
const GwLogger = gwl.GwLogger;
const log = new GwLogger("WARN"); // loglevel is "warn"
```

Now that you have a logger, you can log something:

`log.warn("Did this warning get logged?");`
 
**05-13T21:08:39:027 WARN: Did this warning get logged?**
The line from your logfile shows the result. Obviously, this warning was logged on May 13th at 9:08pm, plus 39 seconds and 27 milliseconds.

`let log = new GwLogger("DEBUG", true, false);`  creates a logger at debug level, and adds logging-to-console, but turns off logging to file. The following statment in your source:`log.debug("Did this debug detail get logged?");`
would result in an item like this on the console:
**DEBUG: Did this debug detail get logged?**

By built-in default, logging is to a file named "./gwl_log.log" in your apps current  working directory. This generally means the directory where myapp.js lives when you type \'node myapp.js\'. There are several ways to specify a different location/name for the logfile, such as using a profile file, an environment variable, or specifying the path when creating a new logger. 

A new instance of GwLogger must be created inside each source file in which you want to do logging. A couple of other examples of logger initialization, the first of which logs to both console and file at the "info" log level:

`const log = new GwLogger("info", true, true);`

`const log = new GwLogger("info", true, true, "./logger/logger.log");`

The second construction above overrides the default logfile location only for its specific logger.

The supported log levels are: OFF, FATAL, ERROR, WARN, NOTICE, INFO, DEV, DEBUG, TRACE, and ALL. Change the log level for any logger instance at any time in your source by calling (for example): `log.setLogLevel("info");`

You can also turn logging on/off to the console or logfile separately at runtime with `log.setIsConsole(`\<boolean>`)`; and, `log.setIsFile(`\<boolean>`);`

The above is about all you\'ll usually need for many NodeJS projects.

Some settings can only be specified at runtime via the API. For instance, the module\'s name (or other short descriptor) can be added near the beginning of each logged statement by adding this in your source code: `log.setModule("myMain");` Timestamps can be added to console output (they always appear in logfiles) by using: `log.setIsConsoleTs(true);` Those two statements would result in:
**05-13T21:08:39:027 DEBUG myMain: Did this debug detail get logged?**
### Timestamp formats ###
Timestamp formats are based on ISO-8601, although that can be tweaked with the profile or environment variables, and at runtime. For instance, you can specify the number of year digits, whether to include milliseconds, or local vs. UTC time.

Besides ISO-8601, you can specify to show timestamps in only milliseconds since 1/1/1970 UTC (the Unix Epoch).

## Profile or Environment Variables
A common way to specify a different basic logging filename and other default parameters is to create a logging profile -- a small json file, saved in the same directory as the initiating application, and shared by all its loggers. It must be named "GwLogger.json", and it is read by GwLogger at load time. Any specified setting will override the default setting for that attribute, but only the attributes shown in the example below can be recognized. This example also documents the built-in defaults.
 ##### Example of gwlogger.json with built-in defaults, plus explanations #####
```json
  {
 	"fn": "./gwl_log.log",	<= path for the logfile
	"logLevelStr": "off",	<= logging level
 	"isConsole": false,		<= whether to log to console or not
 	"isFile": true,		<= whether to log to file or not
 	"isEpoch": false,	<= If true, timestamps will be in milliseconds since 1/1/1970 UTC
 	"nYr": 0,		<= Number of digits to use for the year portion of the timestamp
 	"isLocalTz": true,	<= If false, timestamps will be UTC time instead of local
 	"isShowMs": true	<= Timestamp will include milliseconds if true.
  }
```
 		
If found, all instances of GwLogger for your application will use this profile as your default values. 
  
If you prefer (or are required by your build process) to store the profile as a group of environment variables, then each one should be preceded by "GWL_" so that GwLogger can find them. Such as:
```shell
GWL_fn=mylogfile.txt
GWL_isConsole=true
GWL_nYr=4
```
You\'ll set these in an [operating-system-specific](https://en.wikipedia.org/wiki/Environment_variable "operating-system-specific") way, or maybe use [dotenv](https://github.com/motdotla/dotenv "dotenv").  
Any values that are not set by a profile file or in the environment variables will be initialy set according to the built-in defaults.

To write to a different log file than the built-in default, the profile or in environment variables, pass a new name into a constructor as the fourth parameter: 
`const log = new GwLogger("TRACE", true, true, "mylog.txt");` 
GwLogger attempts to use the same write buffer for all loggers with the same filename, which helps keep timestamps in proper order during heavy logging periods.  This is a good time (maybe too late) to more formally describe the constructor.

### Constructor ###
GwLogger(loglevel, isConsole, isFile, fileName)
Where:
* loglevel is a case-insensitive string, one of: off, fatal, error, notice, info, dev, debug, trace, or all. The default is off;
* isConsole is a boolean and indicates logging should be displayed on console. The default is false;
* isFile is a boolean and indicates logging should be saved to file. If false, no file will be created or appended unless later set to true. the default is true;
* fileName is a string and is the name of a logging path and logfile. If it does not exist it will be created. The path can be relative (based on the current working directory) or absolute. If the directory does not exist, an error will be thrown. The default is "./gwl_log.log\".

Sample Uses:
```javascript
const log = new GwLogger("info", true, true);
const log = new GwLogger("info", true, true, "./logfiles/mylogfile.log");
```

#### Log Levels 
A note about GwLogger log levels: The default is OFF, but log levels can be specified at almost any time, either with the GwLogger.json profile, environment variables, at assignment time as with log = new GwLogger("debug"), or at run time with log.setLogLevel("info"). As with other loggers, logging will occur for any log statement at, or higher, than the currently set log level. Here are the log levels supported by GwLogger:

*	OFF=Does not log *Anything*. This benefits some picky build tools, and is the built-in default.
*	FATAL=Rarely used. The outlook is bleak, stuff is broken! Wake someone up now, the business depends on the code running! Do not use this level lightly! 
*	ERROR=Serious prob, going to try to continue, but will likely die or run suboptimal quality and/or performance.
*	WARN=something unexpected happened, suprisingly we're still okay. This needs to be investigated, but it seems we can keep running.
*	NOTICE=The user may need to do something, (like renew a subscription, backup a DB), other normal business. This is the highest logging level that the business or an end-user would usually care about.
*	INFO=Nothing too important, but interesting process measurements, or just heartbeat-type info. More dev-oriented than business.
*	DEV=DebugLite, or DebugTmp. Use for short periods of intense bug hunting and, well, development. This is a non-standard log level.
*	DEBUG=more detail than INFO. More long-term than DEV.
*	TRACE=debug plus excruciating amount of additional detail, like values inside loops, or colliding spawned processes. Call home, tell them you\'ll be late.
*	ALL=currently same as trace. Included for compatibility's sake, not really useful in GwLogger.

Log levels are used in two ways: To set the current logging level and in logging statements. All the above except OFF and ALL may be used in logging statements, but lower-case only.

### GwLogger\'s Application Programming Interface (API)
The API contains a list of public methods for each logger accessed as in the earlier examples: `log.<apiCall()>.` Settings that can also be specified in the profile are marked with an '*\'. Environment variable names are given, when applicable. API methods will override profile/environment settings, and profile/environment settings will override built-in defaults. If a GwLogger.json file is found, environment variables are ignored.




| Method API  | Description and Default Value |
| -----------| ------------ |
|  getVersion(); |   Returns the version number of your current installation of GwLogger. |
|setModuleName(name); | Optionally tags this logger with the module name, so it can display on each log item. Useful when you have many source files logging into the same file, which is often the case. Helps pin the blame. You could use any text you want as 'name\'. `log.setModuleName("MyModule");  // would show our debug sample statement like this:` **07-13T21:28:00 DEBUG MyModule: Did this debug detail get logged?** There is no default module Name;|
|getModuleName(); | Returns the module name set for this logger, or null if none set.| 
|*setIsEpoch(b); | Timestamp modifier. If boolean is true, then timestamp will be milliseconds since 1/1/1970 (UNIX Epoch). If this is set to true, then other timestamp modifiers (timezone, year-digits, show milliseconds) will be ignored. Default is false. Environment variable: "GWL_isEpoch=`<boolean>`\".|
|getIsEpoch(); | Returns boolean true/false.|
|*setIsLocalTz(b); | ( TODO, should it be setIsLocalTz? )Timestamp modifier. If boolean is true, timestamps will be in local time. If false, times will be UTC. Default is true. Environment variable: "GWL_isLocalTz=`<boolean>`\".|
|getIsLocalTz(); | Returns true/false boolean value.|
|*setYearDigits(n); | Timestamp modifier. Sets the number of timestamp digits to use for year. Must be 0 through 4. Default is 0, do not show year digits. Environment variable: "GWL_nYr=`<0 ... 4>`\".|
|getYearDigits(); | Returns the number of digits for printing the year in a timestamp.
*setIsShowMs(b); | Timestamp modifier. If boolean is true, will include milliseconds as part of normal timestamp. Default is true, show milliseconds. Environment variable: "GWL_isShowMs=`<boolean>`\".|
|getIsShowMs(); | Returns boolean true/false.|
|setIsConsoleTs(b); | If boolean is true, will show timestamps on console logs. Default is false.|
|getIsConsoleTs(); | Returns boolean true/false.|
|*setLogLevel(logLevelStr); | Switches to specified log level. logLevelStr may be off, fatal, error, ..., or all. The logLevelStr is not case-sensitive. Default is "OFF". Environment variable: "GWL_logLevelStr=`<loglevel>`.|
|getLogLevel(); | Returns the current log level.
*setIsConsole(b); | If b is true, will allow logging to console. If false, no logging is done to console. Default is false, no logging to console.|
|getIsConsole(); | Returns boolean true/false|
|*setIsFile(b); |  If b is true, will allow logging to file from this time forward. If false, no logging is done to file. Default is true, log to file. If initially set to false, no file will be created or appended unless later set to true. Environment variable: "GWL_isFile=`<boolean>`\".|
|getIsFile(); | Returns boolean true/false.|
|getFn(); | Returns a string with the path and name of the current logfile.|
|setDepthNum(n); | n is an integer or null. Sets the depth level for logging object contents. Default n is 2. Use null to print all levels.|
|getDepthNum(); | returns an integer.|

Of course, the log statement levels are class methods and also part of the API: fatal, error, warn, notice, dev, debug, and trace. They must be lower-case and use the form:
log.`<level>`(`<data to log>`). You may also comma-separate data items:
`log.dev("Value of object vehicle is: ", vehicle);`

MIT license.
--G. Wilson, 6/2020

