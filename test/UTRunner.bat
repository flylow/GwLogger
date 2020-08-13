@ECHO OFF
REM -- UNIT TEST RUNNER, GwLogger
REM

call envUnset.bat
del .\gwl_log.log
node UnitTestsGwLogger_01.js
node UnitTestsGwLogger_02.js
node UtEsm01.mjs

call envSet.bat
node UnitTestsGwLogger_03.js

call envUnset.bat

