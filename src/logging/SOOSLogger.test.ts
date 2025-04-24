import { LogLevel } from "../enums";
import SOOSLogger from "./SOOSLogger";

const getSut = () => {
  return new SOOSLogger();
};

describe("SOOSLogger", () => {
  test("will log separator in DEBUG", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    const logger = getSut();

    logger.setMinLogLevel(LogLevel.DEBUG);
    logger.logLineSeparator();

    expect(consoleSpy).toHaveBeenCalledWith(
      "--------------------------------------------------------------------------------\n",
    );

    consoleSpy.mockRestore();
  });

  test("will log separator in INFO", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    const logger = getSut();

    logger.setMinLogLevel(LogLevel.INFO);
    logger.logLineSeparator();

    expect(consoleSpy).toHaveBeenCalledWith(
      "--------------------------------------------------------------------------------\n",
    );

    consoleSpy.mockRestore();
  });

  test("will NOT log separator in WARN", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    const logger = getSut();

    logger.setMinLogLevel(LogLevel.WARN);
    logger.logLineSeparator();

    expect(consoleSpy).not.toHaveBeenCalledWith(
      "--------------------------------------------------------------------------------\n",
    );

    consoleSpy.mockRestore();
  });
});
