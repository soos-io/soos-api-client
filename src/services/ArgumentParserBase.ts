import { AttributionFileTypeEnum, AttributionFormatEnum, IntegrationType } from "../enums";
import { ArgumentParser } from "argparse";
import { SOOS_CONSTANTS } from "../constants";
import { IntegrationName, LogLevel, ScanType } from "../enums";
import {
  ensureEnumValue,
  ensureNonEmptyValue,
  generatedScanTypes,
  getEnvVariable,
  isNil,
} from "../utilities";
import { soosLogger } from "../logging";

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
    this.ensureArgumentCombinationsAreValid(args);
    this.checkDeprecatedArguments(args);
    return args;
  }

  isValidExportArguments(
    scanType: ScanType | null | undefined,
    format: AttributionFormatEnum,
    fileType: AttributionFileTypeEnum,
  ): boolean {
    const isGeneratedScanType = !isNil(scanType) && generatedScanTypes.includes(scanType);
    soosLogger.info(`${scanType} is a generated scan type (${isGeneratedScanType})`);

    switch (format) {
      case AttributionFormatEnum.CsafVex:
        return isGeneratedScanType && fileType === AttributionFileTypeEnum.Json;

      case AttributionFormatEnum.CycloneDx:
        return (
          isGeneratedScanType &&
          (fileType === AttributionFileTypeEnum.Json || fileType === AttributionFileTypeEnum.Xml)
        );

      case AttributionFormatEnum.Sarif:
        return fileType === AttributionFileTypeEnum.Json;

      case AttributionFormatEnum.SoosIssues:
        return (
          fileType === AttributionFileTypeEnum.Html || fileType === AttributionFileTypeEnum.Csv
        );

      case AttributionFormatEnum.SoosLicenses:
      case AttributionFormatEnum.SoosPackages:
      case AttributionFormatEnum.SoosVulnerabilities:
        return (
          isGeneratedScanType &&
          (fileType === AttributionFileTypeEnum.Html || fileType === AttributionFileTypeEnum.Csv)
        );

      case AttributionFormatEnum.Spdx:
        return (
          isGeneratedScanType &&
          (fileType === AttributionFileTypeEnum.Json || fileType === AttributionFileTypeEnum.Text)
        );
    }

    return false;
  }

  protected ensureRequiredArguments(args: any): void {
    ensureNonEmptyValue(args.clientId, "clientId");
    ensureNonEmptyValue(args.apiKey, "apiKey");
  }

  protected ensureArgumentCombinationsAreValid(args: any): void {
    if (!this.isValidExportArguments(this.scanType, args.format, args.fileType)) {
      throw new Error(
        `Invalid argument combination for ${this.scanType}. Change ${args.exportFormat} and ${args.exportFileType} to a supported combination (https://kb.soos.io/help/soos-reports-for-export).`,
      );
    }
  }

  protected checkDeprecatedArguments(_args: any): void {
    // NOTE: add any deprecated args here and print a warning if they are referenced - remove _ from args param
  }
}

export { ArgumentParserBase, ICommonArguments };
