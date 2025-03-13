import { AttributionFileTypeEnum, AttributionFormatEnum, IntegrationType } from "../enums";
import { SOOS_CONSTANTS } from "../constants";
import { IntegrationName, LogLevel, ScanType } from "../enums";
import {
  ensureEnumValue,
  ensureNonEmptyValue,
  generatedScanTypes,
  getEnvVariable,
  isNil,
} from "../utilities";
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
  }

  protected addCommonArguments(
    scriptVersion?: string,
    integrationName?: IntegrationName,
    integrationType?: IntegrationType,
  ): void {
    this.addArgument(
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
    this.addArgument(
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

  parseArguments<T extends OptionValues>() {
    this.addCommonArguments(this.scriptVersion, this.integrationName, this.integrationType);
    const args = this.argumentParser.parse(process.argv).opts<T>();
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

  protected ensureRequiredArguments<T extends OptionValues>(args: T): void {
    ensureNonEmptyValue(args.clientId, "clientId");
    ensureNonEmptyValue(args.apiKey, "apiKey");
  }

  protected ensureArgumentCombinationsAreValid<T extends OptionValues>(args: T): void {
    const exportKbMessage = "See https://kb.soos.io/project-exports-and-reports for valid options.";
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected checkDeprecatedArguments<T extends OptionValues>(_args: T): void {
    // NOTE: add any deprecated args here and print a warning if they are referenced - update method params
  }
}

export { ArgumentParserBase, ICommonArguments };
