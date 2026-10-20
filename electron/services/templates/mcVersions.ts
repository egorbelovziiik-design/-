import type { MCVersionCompat } from '../../shared/types';

/**
 * Minecraft version compatibility matrix.
 * Each row maps a Minecraft version to KNOWN-GOOD tool/library versions so the
 * generator never mixes incompatible artifacts.
 */
export const MC_VERSIONS: MCVersionCompat[] = [
  {
    minecraft: '1.21.4',
    java: '21',
    fabricLoader: '0.16.10',
    fabricApi: '0.114.0+1.21.4',
    yarn: '1.21.4+build.8',
    loom: '1.9-SNAPSHOT',
    forge: '54.0.12',
    neoforge: '21.4.30-beta',
    quiltLoader: '0.27.1-beta.1',
  },
  {
    minecraft: '1.21.1',
    java: '21',
    fabricLoader: '0.16.9',
    fabricApi: '0.110.5+1.21.1',
    yarn: '1.21.1+build.3',
    loom: '1.8-SNAPSHOT',
    forge: '52.0.16',
    neoforge: '21.1.90',
    quiltLoader: '0.27.1-beta.1',
  },
  {
    minecraft: '1.20.6',
    java: '21',
    fabricLoader: '0.15.11',
    fabricApi: '0.100.1+1.20.6',
    yarn: '1.20.6+build.3',
    loom: '1.7-SNAPSHOT',
    forge: '50.1.21',
    neoforge: '20.6.119',
    quiltLoader: '0.26.4',
  },
  {
    minecraft: '1.20.4',
    java: '17',
    fabricLoader: '0.15.11',
    fabricApi: '0.97.2+1.20.4',
    yarn: '1.20.4+build.3',
    loom: '1.6-SNAPSHOT',
    forge: '49.0.49',
    neoforge: '20.4.237',
    quiltLoader: '0.26.4',
  },
  {
    minecraft: '1.20.1',
    java: '17',
    fabricLoader: '0.15.11',
    fabricApi: '0.92.2+1.20.1',
    yarn: '1.20.1+build.10',
    loom: '1.6-SNAPSHOT',
    forge: '47.3.0',
    neoforge: '20.1.116',
    quiltLoader: '0.26.4',
  },
  {
    minecraft: '1.19.2',
    java: '17',
    fabricLoader: '0.15.11',
    fabricApi: '0.77.0+1.19.2',
    yarn: '1.19.2+build.28',
    loom: '1.4-SNAPSHOT',
    forge: '43.3.0',
    neoforge: '19.2.0',
    quiltLoader: '0.26.4',
  },
  {
    minecraft: '1.18.2',
    java: '17',
    fabricLoader: '0.15.11',
    fabricApi: '0.67.0+1.18.2',
    yarn: '1.18.2+build.4',
    loom: '1.4-SNAPSHOT',
    forge: '40.2.21',
    neoforge: '18.2.0',
    quiltLoader: '0.26.4',
  },
  {
    minecraft: '1.16.5',
    java: '8',
    fabricLoader: '0.14.25',
    fabricApi: '0.42.0+1.16',
    yarn: '1.16.5+build.10',
    loom: '0.10-SNAPSHOT',
    forge: '36.2.42',
    neoforge: '16.5.0',
    quiltLoader: '0.26.4',
  },
  {
    minecraft: '1.8.9',
    java: '8',
    fabricLoader: '0.14.25',
    fabricApi: '0.42.0+1.16',
    yarn: '1.8.9+build.3',
    loom: '0.10-SNAPSHOT',
    forge: '11.15.1.2318',
    neoforge: '8.9.0',
    quiltLoader: '0.26.4',
  },
];

export function compatFor(version: string): MCVersionCompat {
  return MC_VERSIONS.find((v) => v.minecraft === version) ?? MC_VERSIONS[0];
}

export function gradleWrapperProperties(gradleVersion = '8.10.2'): string {
  return `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-${gradleVersion}-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
}

/** Minimal but valid gradlew / gradlew.bat — official-style launchers. */
export const GRADLEW_SH = `#!/bin/sh
# Gradle wrapper launcher (WinCode AI generated)

# Attempt to set APP_HOME
PRG="$0"
while [ -h "$PRG" ] ; do
  ls=\`ls -ld "$PRG"\`
  link=\`expr "$ls" : '.*-> \\(.*\\)$'\`
  if expr "$link" : '/.*' > /dev/null; then
    PRG="$link"
  else
    PRG=\`dirname "$PRG"\`/"$link"
  fi
done
SAVED="\`pwd\`"
cd "\`dirname \\"$PRG"\`/" >/dev/null
APP_HOME="\`pwd -P\`"
cd "$SAVED" >/dev/null

CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar

if [ -n "$JAVA_HOME" ] ; then
  JAVACMD="$JAVA_HOME/bin/java"
else
  JAVACMD="java"
fi

exec "$JAVACMD" $JAVA_OPTS -classpath "$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "$@"
`;

export const GRADLEW_BAT = `@rem Gradle wrapper launcher (WinCode AI generated)
@if "%DEBUG%"=="" @echo off
setlocal
set DIRNAME=%~dp0
set APP_HOME=%DIRNAME%
set CLASSPATH=%APP_HOME%gradle\\wrapper\\gradle-wrapper.jar

if defined JAVA_HOME (
  set JAVA_EXE=%JAVA_HOME%\\bin\\java.exe
) else (
  set JAVA_EXE=java.exe
)

"%JAVA_EXE%" %JAVA_OPTS% -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
endlocal
`;
