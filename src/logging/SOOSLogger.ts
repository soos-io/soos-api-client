import { LogLevel } from "../enums";

class SOOSLogger {
  private static orderedLogLevels = Object.keys(LogLevel);

  private console: Console;
  private minLogLevel: LogLevel;

  constructor(minLogLevel: LogLevel = LogLevel.INFO, console: Console = global.console) {
    this.console = console;
    this.minLogLevel = minLogLevel;
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

  private logWithTimestamp(level: LogLevel, message?: unknown, ...optionalParams: unknown[]): void {
    if (this.shouldLog(level)) {
      this.console.log(
        `${this.getTimeStamp()} UTC [${LogLevel[level]}] ${message}`,
        ...optionalParams,
      );
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return (
      SOOSLogger.orderedLogLevels.indexOf(level) >=
      SOOSLogger.orderedLogLevels.indexOf(this.minLogLevel)
    );
  }

  setMinLogLevel(minLogLevel: LogLevel) {
    this.minLogLevel = minLogLevel;
  }

  debug(message?: unknown, ...optionalParams: unknown[]): void {
    this.logWithTimestamp(LogLevel.DEBUG, message, ...optionalParams);
  }

  info(message?: unknown, ...optionalParams: unknown[]): void {
    this.logWithTimestamp(LogLevel.INFO, message, ...optionalParams);
  }

  warn(message?: unknown, ...optionalParams: unknown[]): void {
    this.logWithTimestamp(LogLevel.WARN, message, ...optionalParams);
  }

  error(message?: unknown, ...optionalParams: unknown[]): void {
    this.logWithTimestamp(LogLevel.ERROR, message, ...optionalParams);
  }

  group(...label: unknown[]): void {
    this.console.group(...label);
  }

  groupEnd(): void {
    this.console.groupEnd();
    this.console.log("\n");
  }

  always(message?: unknown, ...optionalParams: unknown[]): void {
    this.console.log(`${this.getTimeStamp()} UTC [SOOS] ${message}`, ...optionalParams);
  }
}

export default SOOSLogger;

// global instance reference
export const soosLogger = new SOOSLogger();
