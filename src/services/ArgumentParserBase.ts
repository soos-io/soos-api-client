import { IntegrationType } from "../enums";
import { SOOS_CONSTANTS } from "../constants";
import { IntegrationName, LogLevel, ScanType } from "../enums";
import { ensureEnumValue, ensureNonEmptyValue, getEnvVariable } from "../utilities";
import { Command, Option, OptionValues } from "commander";

const getIntegrateUrl = (scanType?: ScanType): string =>
  `${SOOS_CONSTANTS.Urls.App.Home}integrate/${
    scanType == ScanType.CSA ? "containers" : (scanType ?? ScanType.SCA).toLowerCase()
  }`;

interface ICommonArguments {
  apiKey: string;
  apiURL: string;
  clientId: string;
  logLevel: LogLevel;
  scriptVersion: string;
}

abstract class ArgumentParserBase {
  private argumentParser: Command;

  protected scanType?: ScanType;
  protected scriptVersion: string = "0.0.0";
  protected integrationName?: IntegrationName;
  protected integrationType?: IntegrationType;

  protected constructor(
    description: string,
    scanType?: ScanType,
    scriptVersion?: string,
    integrationName?: IntegrationName,
    integrationType?: IntegrationType,
  ) {
    this.argumentParser = new Command().description(description);
    this.scanType = scanType;
    this.scriptVersion = scriptVersion ?? "0.0.0";
    this.integrationName = integrationName;
    this.integrationType = integrationType;

    this.addCommonArguments(this.scriptVersion, this.integrationName, this.integrationType);
  }

  protected addCommonArguments(
    scriptVersion?: string,
    integrationName?: IntegrationName,
    integrationType?: IntegrationType,
  ): void {
    this.addArgument("apiKey", `SOOS API Key - get yours from ${getIntegrateUrl(this.scanType)}`, {
      defaultValue: getEnvVariable(SOOS_CONSTANTS.EnvironmentVariables.ApiKey) ?? undefined,
      required: true,
    });
    this.addArgument("apiURL", "SOOS API URL", {
      defaultValue: SOOS_CONSTANTS.Urls.API.Analysis,
      argParser: (value: string) => ensureNonEmptyValue(value, "apiURL"),
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
    },
  ): void {
    const flags = `--${name} <${name}>`;
    const option = new Option(flags, description);

    if (options?.defaultValue) {
      option.default(options.defaultValue);
    }

    if (options?.internal) {
      option.hideHelp();
    }

    if (options?.required) {
      option.required = true;
    }

    if (options?.argParser) {
      option.argParser(options.argParser);
    }

    if (options?.choices) {
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
    this.addArgument(name, description, {
      defaultValue: options?.defaultValue,
      argParser,
      internal: options?.internal,
      required: options?.required,
    });
  }

  parseArguments<T extends OptionValues>(argv?: string[]) {
    const args = this.argumentParser.parse(argv ?? process.argv).opts<T>();
    return args;
  }
}

export { ArgumentParserBase, ICommonArguments };
