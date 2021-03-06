Change Log for @flylow/GwLogger
(Dates are YYYY:MM:DD)

## Features and Fixes Releases ##
|Release   |Date| Summary  |
| ------------ | -- | ------------ |
| 1.0	| 2020:08:04 | Initial Release |
| 1.0.1 | 2020:08:14 | Update README.MD and version numbers |
| 1.1.0 | 2020:09:21 | Added Rolling Logs by Size and Individual Profiles |
| 1.1.1 | 2020:09:28 | Fixes for [Rolling Logs by size, issue 2](https://github.com/flylow/GwLogger/issues/2 "Rolling Logs by size, issue 2"), and [Bad Error Message, issue 1](https://github.com/flylow/GwLogger/issues/1 "Bad Error Message, issue 1") |
| 1.2.0 | 2020:10:20 | Added rolling logs at startup.  Fixes for [Rolling files to network drives, issue 3](https://github.com/flylow/GwLogger/issues/3 "Rolling files to network drives, issue 3"), and [Changing rolling settings prior to activating logger causes exception, issue 4](https://github.com/flylow/GwLogger/issues/4 "Changing rolling settings prior to activating logger causes exception, issue 4") |
| 1.2.1 | 2020:10:28 | Separate msgs from code, try/catch fixes, minor edits |
| 1.2.2 | 2020:10:30 | Docs fix, Fix README API description for setIsRollAtStart |
| 1.2.3 | 2020:11:11 | Minor bug fixes and coding/testing improvements. |
| 1.3.0 | 2020:11:25 | Added isColor for console/stdout logging. Added setSepCharFile and setSepCharConsole to aid the importing of logfiles into databases. Added isRollAsArchive to save compressed logfiles at the end of the rolling logs pipeline. Many bugfixes and readme edits.|
| 1.3.1 | 2020:11:25 | Fixed a bug using isFile/isConsole in constructor
| 1.4.0 | 2020:11:29 | Added ability to specify archiveLogPath separately from rolledLogPath.  Made changes so that no error occurs if rolledLogPath and/or archiveLogPath is not defined (archiveLogPath would use rolledLogPath, and rolledLogPath would use the logfile\'s path. |
| 1.5.0 | 2020:12:21 | Improved and documented error handling. Consolidated profile verifications at startup. Added support for event listeners for runtime monitoring. Added new test cases. Miscellanious code fixes.|
| 1.5.1 | 2021:01:01 | Bug fixes for isColor management and event msgs in GwLogger.js, haltAllRolling fix in WritePool.js. Bugs #6 and #7. |
| 1.5.2 | 2021:01:29 | Small code improvements, and JSDoc additions. |
| 1.5.3 | 2021:03:10 | Fix for issue #8,[Timestamp on archive should follow original logfile](https://github.com/flylow/GwLogger/issues/8#issue-823236730). Also, refactored rollfiles functionality into its own class file, including correct creation of the default logfile.
| 1.5.4	| 2021:06:04 | Fix to issue #9, (Fix missing file spec in package.json). |
| 1.5.5 | 2021:07:06 | Fix for issue #10 (creation of default logfile). Added test cases to check all default settings are properly set at startup.

