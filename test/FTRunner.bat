@ECHO OFF
REM -- FUNCTIONAL TEST RUNNER, GwLogger
REM


call envUnset.bat
node FuncTestCon_01.js
node FuncTest_02.js
node FuncTest_03.js
node FuncTest_04.js
