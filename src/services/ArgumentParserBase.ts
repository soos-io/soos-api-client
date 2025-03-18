import { IntegrationType } from "../enums";
import { SOOS_CONSTANTS } from "../constants";
import { IntegrationName, LogLevel, ScanType } from "../enums";
import { ensureEnumValue, getEnumOptions, getEnvVariable } from "../utilities";
import { Command, createArgument, createCommand, createOption, Option } from "commander";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedOptions = Record<string, any>;

interface ICommonArguments {
  apiKey: string;
  apiURL: string;
  clientId: string;
  integrationName: IntegrationName;
  integrationType: IntegrationType;
  logLevel: LogLevel;
  scanType: ScanType;
  scriptVersion: string;
}

const getIntegrateUrl = (scanType?: ScanType): string =>
  `${SOOS_CONSTANTS.Urls.App.Home}integrate/${
    scanType == ScanType.CSA ? "containers" : (scanType ?? ScanType.SCA).toLowerCase()
  }`;

abstract class ArgumentParserBase {
  private argumentParser: Command;

  public description: string;
  public scanType: ScanType;
  public scriptVersion: string;
  public integrationName: IntegrationName;
  public integrationType: IntegrationType;

  protected constructor(
    description: string,
    scanType: ScanType,
    scriptVersion: string,
    integrationName: IntegrationName,
    integrationType: IntegrationType,
  ) {
    this.description = description;
    this.scanType = scanType;
    this.scriptVersion = scriptVersion;
    this.integrationName = integrationName;
    this.integrationType = integrationType;

    this.argumentParser = createCommand().description(this.description).version(this.scriptVersion);

    this.addCommonArguments(this.scriptVersion, this.integrationName, this.integrationType);
  }

  private parseCommanderOptions<T extends ParsedOptions>(argv?: string[]) {
    return this.argumentParser.parse(argv ?? process.argv).opts<T>();
  }

  private parseCommanderArguments() {
    return Object.fromEntries(
      this.argumentParser.registeredArguments
        .map((a) => a.name())
        .map((name, index) => [name, this.argumentParser.args[index]]),
    );
  }

  private getCombinedCommanderOptionsAndArguments<T extends ParsedOptions>(argv?: string[]) {
    const args = this.parseCommanderArguments();
    const options = this.parseCommanderOptions<T>(argv);
    return { ...args, ...options };
  }

  protected addCommonArguments(
    scriptVersion: string,
    integrationName: IntegrationName,
    integrationType: IntegrationType,
  ): void {
    this.addArgument("apiKey", `SOOS API Key - get yours from ${getIntegrateUrl(this.scanType)}`, {
      defaultValue: getEnvVariable(SOOS_CONSTANTS.EnvironmentVariables.ApiKey) ?? undefined,
      required: true,
    });
    this.addArgument("apiURL", "SOOS API URL", {
      defaultValue: SOOS_CONSTANTS.Urls.API.Analysis,
      internal: true,
    });
    this.addArgument(
      "clientId",
      `SOOS Client ID - get yours from ${getIntegrateUrl(this.scanType)}`,
      {
        defaultValue: getEnvVariable(SOOS_CONSTANTS.EnvironmentVariables.ClientId) ?? undefined,
        required: true,
      },
    );
    this.addArgument("integrationName", "Integration Name", {
      defaultValue: integrationName,
      required: true,
      internal: true,
    });
    this.addEnumArgument("integrationType", IntegrationType, "Integration Type", {
      defaultValue: integrationType,
      internal: true,
      required: true,
    });

    // NOTE: "logLevel" is "special" in the underlying implementation, so we can't use our addArgument method
    this.argumentParser.addOption(
      new Option("--logLevel <logLevel>", "Minimum log level to display.")
        .choices([LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.FAIL, LogLevel.ERROR])
        .default(LogLevel.INFO),
    );

    this.addArgument("scriptVersion", "Script Version", {
      defaultValue: scriptVersion,
      internal: true,
      required: true,
    });
  }

  addArgument(
    name: string,
    description: string,
    options?: {
      defaultValue?: unknown;
      internal?: boolean;
      required?: boolean;
      argParser?: (value: string) => unknown;
      choices?: string[];
      useNoOptionKey?: boolean;
      isFlag?: boolean;
    },
  ): void {
    if (options?.useNoOptionKey) {
      // we are actually using a commander argument
      const argument = createArgument(name, description);

      if (options?.defaultValue) {
        argument.default(options.defaultValue);
      }

      if (options?.internal) {
        throw new Error("internal is not applicable");
      }

      if (options?.required) {
        throw new Error("required is not applicable");
      }

      if (options?.argParser) {
        argument.argParser(options.argParser);
      }

      if (options?.choices) {
        argument.choices(options.choices);
      }

      if (options?.isFlag) {
        throw new Error("isFlag is not applicable");
      }

      this.argumentParser.addArgument(argument);
      return;
    }

    const flags = options?.isFlag ? `--${name}` : `--${name} <${name}>`;
    const option = createOption(flags, description);

    if (options?.defaultValue) {
      option.default(options.defaultValue);
    }

    if (options?.internal) {
      option.hideHelp();
    }

    if (options?.required) {
      option.makeOptionMandatory(true);
    }

    if (options?.argParser) {
      if (options?.isFlag) {
        throw new Error("argParser is not applicable");
      }

      option.argParser(options.argParser);
    }

    if (options?.choices) {
      if (options?.isFlag) {
        throw new Error("choices is not applicable");
      }

      option.choices(options.choices);
    }

    this.argumentParser.addOption(option);
  }

  addEnumArgument<T, TEnumObject extends Record<string, T>>(
    name: string,
    enumObject: TEnumObject,
    description: string,
    options: {
      defaultValue: T;
      allowMultipleValues?: boolean;
      excludeDefault?: string;
      internal?: boolean;
      required?: boolean;
    },
  ): void {
    const descriptionWithOptions = `${description} Options: ${getEnumOptions<T, TEnumObject>(
      enumObject,
      options.excludeDefault,
    )
      .map(([, value]) => value)
      .join(", ")}`;
    const argParser = options?.allowMultipleValues
      ? (value: string): T[] => {
          return value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v !== "")
            .map(
              (v) =>
                ensureEnumValue(enumObject, v, name, options?.excludeDefault) ??
                options.defaultValue,
            );
        }
      : (value: string): T => {
          return (
            ensureEnumValue(enumObject, value, name, options?.excludeDefault) ??
            options.defaultValue
          );
        };
    this.addArgument(name, descriptionWithOptions, {
      defaultValue: options?.defaultValue,
      argParser,
      internal: options?.internal,
      required: options?.required,
    });
  }

  /**
   * Does a cursory parse of the command line, allowing unknown options to flow through
   */
  preParseArguments<T extends ParsedOptions>(argv?: string[]) {
    this.argumentParser.allowUnknownOption().allowExcessArguments();
    const all = this.getCombinedCommanderOptionsAndArguments<T>(argv);
    this.argumentParser.allowUnknownOption(false).allowExcessArguments(false);
    return all;
  }

  /**
   * Parse of the command line, does not allow unknown options
   */
  parseArguments<T extends ParsedOptions>(argv?: string[]) {
    const all = this.getCombinedCommanderOptionsAndArguments<T>(argv);
    return all;
  }
}

export { ArgumentParserBase, ICommonArguments, ParsedOptions };
