#!/bin/bash
# script sets  environment variables for UnitTestsGwLogger_03.js unit test.
# on CL, run with "source ./setEnv.sh"
export GWL_logLevelStr=FATAL
export GWL_fn=./logfiles/EnvTest.log
export GWL_isFile=false
export GWL_isConsole=true
export GWL_isColor=true
export GWL_isEpoch=false
export GWL_nYr=1
export GWL_isShowMs=false
export GWL_isLocalTz=false
export GWL_isConsoleTs=true
export GWL_isRollAtStartup=true
export GWL_isRollBySize=false
export GWL_maxLogSizeKb=0
export GWL_maxNumRollingLogs=0
export GWL_rollingLogPath=./rolledfiles/rolledfiles2