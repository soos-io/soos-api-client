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
    this.addRequiredArgument(
      "--apiKey",
      `SOOS API Key - get yours from ${getIntegrateUrl(this.scanType)}`,
      getEnvVariable(SOOS_CONSTANTS.EnvironmentVariables.ApiKey) ?? undefined,
    );
    this.addArgument(
      "--apiURL, --apiUrl",
      "SOOS API URL",
      SOOS_CONSTANTS.Urls.API.Analysis,
      (value: string) => ensureNonEmptyValue(value, "apiURL"),
    );
    this.addRequiredArgument(
      "--clientId",
      `SOOS Client ID - get yours from ${getIntegrateUrl(this.scanType)}`,
      getEnvVariable(SOOS_CONSTANTS.EnvironmentVariables.ClientId) ?? undefined,
    );
    this.addInternalArgument("--integrationName", "Integration Name", integrationName);
    this.addEnumArgument(
      "--integrationType",
      IntegrationType,
      "Integration Type",
      integrationType,
      {
        internal: true,
      },
    );
    this.addEnumArgument(
      "--logLevel",
      LogLevel,
      "Minimum level to show logs: DEBUG, INFO, WARN, FAIL, ERROR.",
      LogLevel.INFO,
    );
    this.addInternalArgument("--scriptVersion", "Script Version", scriptVersion);
  }

  addArgument(
    flags: string,
    description: string,
    defaultValue?: unknown,
    argParser?: (value: string) => unknown,
  ): void {
    const option = new Option(flags, description);
    if (defaultValue) {
      option.default(defaultValue);
    }
    if (argParser) {
      option.argParser(argParser);
    }

    this.argumentParser.addOption(option);
  }

  addRequiredArgument(
    flags: string,
    description: string,
    defaultValue?: unknown,
    argParser?: (value: string) => unknown,
  ): void {
    const option = new Option(flags, description);
    option.required = true;
    if (defaultValue) {
      option.default(defaultValue);
    }
    if (argParser) {
      option.argParser(argParser);
    }

    this.argumentParser.addOption(option);
  }

  addInternalArgument(
    flags: string,
    description: string,
    defaultValue?: unknown,
    argParser?: (value: string) => unknown,
  ): void {
    const option = new Option(flags, description);
    option.hideHelp(); // internal args don't show in the help context
    if (defaultValue) {
      option.default(defaultValue);
    }
    if (argParser) {
      option.argParser(argParser);
    }
  }

  addEnumArgument(
    flags: string,
    enumObject: Record<string, unknown>,
    description: string,
    defaultValue: unknown,
    options?: {
      allowMultipleValues?: boolean;
      excludeDefault?: string;
      internal?: boolean;
    },
  ): void {
    const option = new Option(flags, description).default(defaultValue);
    option.argParser((value: string) => {
      if (options?.allowMultipleValues) {
        return value
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v !== "")
          .map((v) => ensureEnumValue(enumObject, v, flags, options?.excludeDefault));
      }

      return ensureEnumValue(enumObject, value, flags, options?.excludeDefault);
    });
    if (options?.internal) {
      option.hideHelp();
    }
    this.argumentParser.addOption(option);
  }

  parseArguments<T extends OptionValues>(argv?: string[]) {
    const args = this.argumentParser.parse(argv ?? process.argv, { from: "node" }).opts<T>();
    return args;
  }
}

export { ArgumentParserBase, ICommonArguments };
