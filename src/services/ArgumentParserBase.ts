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
    excludeDefault: string | undefined = undefined,
  ): void {
    parser.add_argument(argName, {
      ...options,
      type: (value: string) => {
        if (allowMultipleValues) {
          return value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v !== "")
            .map((v) => ensureEnumValue(enumObject, v, argName, excludeDefault));
        }

        return ensureEnumValue(enumObject, value, argName, excludeDefault);
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

  validateExportArguments(
    scanType: ScanType | undefined,
    format: AttributionFormatEnum,
    fileType: AttributionFileTypeEnum,
  ): string | null {
    const isGeneratedScanType = scanType && generatedScanTypes.includes(scanType);

    if (
      !isGeneratedScanType &&
      [
        AttributionFormatEnum.CsafVex,
        AttributionFormatEnum.CycloneDx,
        AttributionFormatEnum.SoosLicenses,
        AttributionFormatEnum.SoosPackages,
        AttributionFormatEnum.SoosVulnerabilities,
        AttributionFormatEnum.Spdx,
      ].some((f) => f === format)
    ) {
      return `This scan type is not supported for ${format}.`;
    }

    switch (format) {
      case AttributionFormatEnum.CsafVex:
        return fileType === AttributionFileTypeEnum.Json
          ? null
          : `${format} only supports ${AttributionFileTypeEnum.Json} export.`;

      case AttributionFormatEnum.CycloneDx:
        return fileType === AttributionFileTypeEnum.Json || fileType === AttributionFileTypeEnum.Xml
          ? null
          : `${format} only supports ${AttributionFileTypeEnum.Json} or ${AttributionFileTypeEnum.Xml} export.`;

      case AttributionFormatEnum.Sarif:
        return fileType === AttributionFileTypeEnum.Json
          ? null
          : `${format} only supports ${AttributionFileTypeEnum.Json} export.`;

      case AttributionFormatEnum.SoosIssues:
        return fileType === AttributionFileTypeEnum.Html || fileType === AttributionFileTypeEnum.Csv
          ? null
          : `${format} only supports ${AttributionFileTypeEnum.Html} or ${AttributionFileTypeEnum.Csv} export.`;

      case AttributionFormatEnum.SoosLicenses:
      case AttributionFormatEnum.SoosPackages:
      case AttributionFormatEnum.SoosVulnerabilities:
        return fileType === AttributionFileTypeEnum.Html || fileType === AttributionFileTypeEnum.Csv
          ? null
          : `${format} only supports ${AttributionFileTypeEnum.Html} or ${AttributionFileTypeEnum.Csv} export.`;

      case AttributionFormatEnum.Spdx:
        return fileType === AttributionFileTypeEnum.Json ||
          fileType === AttributionFileTypeEnum.Text
          ? null
          : `${format} only supports ${AttributionFileTypeEnum.Json} or ${AttributionFileTypeEnum.Text} export.`;
      default:
        return "Change the export format and file type to a supported combination.";
    }
  }

  protected ensureRequiredArguments(args: any): void {
    ensureNonEmptyValue(args.clientId, "clientId");
    ensureNonEmptyValue(args.apiKey, "apiKey");
  }

  protected ensureArgumentCombinationsAreValid(args: any): void {
    const exportKbMessage =
      "See  https://kb.soos.io/help/soos-reports-for-export for valid options.";
    const hasExportFormat = !isNil(args.exportFormat);
    const hasExportFileType = !isNil(args.exportFileType);

    if (!hasExportFormat && !hasExportFileType) {
      return;
    }

    if (!hasExportFormat && hasExportFileType) {
      throw new Error(
        `Please provide a value for --exportFormat when specifying --exportFileType. ${exportKbMessage}`,
      );
    }

    if (hasExportFormat && !hasExportFileType) {
      throw new Error(
        `Please provide a value for --exportFileType when specifying --exportFormat. ${exportKbMessage}`,
      );
    }

    const validationMessage = this.validateExportArguments(
      this.scanType,
      args.exportFormat,
      args.exportFileType,
    );
    if (validationMessage !== null) {
      throw new Error(`Invalid export arguments. ${validationMessage} ${exportKbMessage}`);
    }
  }

  protected checkDeprecatedArguments(_args: any): void {
    // NOTE: add any deprecated args here and print a warning if they are referenced - remove _ from args param
  }
}

export { ArgumentParserBase, ICommonArguments };
