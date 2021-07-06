@ECHO OFF
REM -- UNIT TEST RUNNER, GwLogger
REM --- see test/DescriptionsOfTests.txt
REM

call envUnset.bat

@ECHO OFF
node UnitTestsGwLogger_01.js
node UnitTestsGwLogger_02.js
call envSet.bat
node UnitTestsGwLogger_03.js
call envUnset.bat
node UnitTestsGwLogger_04.js
node --experimental-modules  UnitTestsGwLogger_05.mjs
node UnitTestsGwLogger_06.js
cd testDefaults
node UnitTestsGwLogger_07.js
cd ..

