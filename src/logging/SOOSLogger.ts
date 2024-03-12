import { LogLevel } from "../enums";

class SOOSLogger {
  private verbose: boolean;
  private console: Console;
  private minLogLevel: LogLevel;

  constructor(
    verbose: boolean = false,
    minLogLevel: LogLevel = LogLevel.INFO,
    console: Console = global.console,
  ) {
    this.verbose = verbose;
    this.console = console;
    this.minLogLevel = this.verbose ? LogLevel.DEBUG : minLogLevel;
  }

  private getTimeStamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const hours = (now.getHours() % 12 || 12).toString().padStart(2, "0");
    const ampm = now.getHours() >= 12 ? "PM" : "AM";
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");

    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${ampm}`;

    return `${timestamp}`;
  }

  private logWithTimestamp(level: LogLevel, message?: any, ...optionalParams: any[]): void {
    if (this.shouldLog(level)) {
      const logLevelKey = LogLevel[level];
      const timestamp = this.getTimeStamp();
      const logMessage = `${timestamp} UTC [${logLevelKey}] ${message}`;
      this.console.log(logMessage, ...optionalParams);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const orderedKeys = Object.keys(LogLevel);
    return orderedKeys.indexOf(level) >= orderedKeys.indexOf(this.minLogLevel);
  }

  setVerbose(verbose: boolean) {
    // TODO - PA-13294 - Consolidate verbose and log level to avoid overriding log level
    this.verbose = this.verbose ? this.verbose : verbose;
    if (this.verbose) this.minLogLevel = LogLevel.DEBUG;
  }

  setMinLogLevel(minLogLevel: LogLevel) {
    this.minLogLevel = minLogLevel;
    if (this.minLogLevel === LogLevel.DEBUG) this.verbose = true;
  }

  debug(message?: any, ...optionalParams: any[]): void {
    this.logWithTimestamp(LogLevel.DEBUG, message, ...optionalParams);
  }

  info(message?: any, ...optionalParams: any[]): void {
    this.logWithTimestamp(LogLevel.INFO, message, ...optionalParams);
  }

  warn(message?: any, ...optionalParams: any[]): void {
    this.logWithTimestamp(LogLevel.WARN, message, ...optionalParams);
  }

  error(message?: any, ...optionalParams: any[]): void {
    this.logWithTimestamp(LogLevel.ERROR, message, ...optionalParams);
  }

  group(...label: any[]): void {
    this.console.group(...label);
  }

  groupEnd(): void {
    this.console.groupEnd();
    this.console.log("\n");
  }

  verboseDebug(message?: any, ...optionalParams: any[]): void {
    if (this.verbose) {
      this.debug(message, ...optionalParams);
    }
  }

  verboseInfo(message?: any, ...optionalParams: any[]): void {
    if (this.verbose) {
      this.info(message, ...optionalParams);
    }
  }

  verboseWarn(message?: any, ...optionalParams: any[]): void {
    if (this.verbose) {
      this.warn(message, ...optionalParams);
    }
  }

  verboseError(message?: any, ...optionalParams: any[]): void {
    if (this.verbose) {
      this.error(message, ...optionalParams);
    }
  }

  verboseGroup(...label: any[]): void {
    if (this.verbose) {
      this.group(...label);
    }
  }

  verboseGroupEnd(): void {
    if (this.verbose) {
      this.groupEnd();
    }
  }

  always(message?: any, ...optionalParams: any[]): void {
    const timestamp = this.getTimeStamp();
    const logMessage = `${timestamp} UTC [SOOS] ${message}`;
    this.console.log(logMessage, ...optionalParams);
  }

  logLineSeparator(): void {
    const separator = "-".repeat(80);
    this.console.log(`${separator}\n`);
  }
}

export default SOOSLogger;

// global instance reference
export const soosLogger = new SOOSLogger();
