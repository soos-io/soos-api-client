import { IntegrationType } from "../enums";
import { ArgumentParser } from "argparse";
import { SOOS_CONSTANTS } from "../constants";
import { IntegrationName, LogLevel, ScanType } from "../enums";
import { ensureEnumValue, ensureNonEmptyValue, getEnvVariable } from "../utilities";

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

  /**
   * @deprecated Only here for backwards compatibility, do not reference.
   */
  verbose: boolean;
}

abstract class ArgumentParserBase {
  public argumentParser: ArgumentParser;
  protected scanType?: ScanType;
  protected scriptVersion: string = "0.0.0";
  protected integrationName?: IntegrationName;
  protected integrationType?: IntegrationType;

  protected constructor(
    argumentParser: ArgumentParser,
    scanType?: ScanType,
    scriptVersion?: string,
    integrationName?: IntegrationName,
    integrationType?: IntegrationType,
  ) {
    this.argumentParser = argumentParser;
    this.scanType = scanType;
    this.scriptVersion = scriptVersion ?? "0.0.0";
    this.integrationName = integrationName;
    this.integrationType = integrationType;
  }

  protected addCommonArguments(
    scriptVersion?: string,
    integrationName?: IntegrationName,
    integrationType?: IntegrationType,
  ): void {
    this.argumentParser.add_argument("--apiKey", {
      help: `SOOS API Key - get yours from ${getIntegrateUrl(this.scanType)}`,
      default: getEnvVariable(SOOS_CONSTANTS.EnvironmentVariables.ApiKey),
      required: false,
    });

    this.argumentParser.add_argument("--apiURL", {
      help: "SOOS API URL - Intended for internal use only, do not modify.",
      default: SOOS_CONSTANTS.Urls.API.Analysis,
      required: false,
      type: (value: string) => {
        return ensureNonEmptyValue(value, "apiURL");
      },
    });

    this.argumentParser.add_argument("--clientId", {
      help: `SOOS Client ID - get yours from ${getIntegrateUrl(this.scanType)}`,
      default: getEnvVariable(SOOS_CONSTANTS.EnvironmentVariables.ClientId),
      required: false,
    });

    this.addEnumArgument(this.argumentParser, "--integrationName", IntegrationName, {
      help: "Integration Name - Intended for internal use only.",
      required: false,
      default: integrationName,
    });

    this.addEnumArgument(this.argumentParser, "--integrationType", IntegrationType, {
      help: "Integration Type - Intended for internal use only.",
      required: false,
      default: integrationType,
    });

    this.addEnumArgument(this.argumentParser, "--logLevel", LogLevel, {
      help: "Minimum level to show logs: DEBUG, INFO, WARN, FAIL, ERROR.",
      default: LogLevel.INFO,
      required: false,
    });

    this.argumentParser.add_argument("--scriptVersion", {
      help: "Script Version - Intended for internal use only.",
      required: false,
      default: scriptVersion,
    });

    this.argumentParser.add_argument("--verbose", {
      help: "DEPRECATED - Change logLevel to DEBUG. This parameter has no effect.",
      action: "store_true",
      default: false,
      required: false,
    });
  }

  addEnumArgument(
    parser: ArgumentParser,
    argName: string,
    enumObject: Record<string, unknown>,
    options = {},
    allowMultipleValues = false,
  ): void {
    parser.add_argument(argName, {
      ...options,
      type: (value: string) => {
        if (allowMultipleValues) {
          return value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v !== "")
            .map((v) => ensureEnumValue(enumObject, v, argName));
        }

        return ensureEnumValue(enumObject, value, argName);
      },
    });
  }

  parseArguments() {
    this.addCommonArguments(this.scriptVersion, this.integrationName, this.integrationType);
    const args = this.argumentParser.parse_args();
    this.ensureRequiredArguments(args);
    return args;
  }

  protected ensureRequiredArguments(args: any): void {
    ensureNonEmptyValue(args.clientId, "clientId");
    ensureNonEmptyValue(args.apiKey, "apiKey");
  }
}

export { ArgumentParserBase, ICommonArguments };
