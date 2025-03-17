import { OptionValues } from "commander";
import {
  AttributionFileTypeEnum,
  AttributionFormatEnum,
  ContributingDeveloperSource,
  IntegrationName,
  IntegrationType,
  OnFailure,
  ScanType,
} from "../enums";
import { ensureNonEmptyValue, generatedScanTypes, isNil } from "../utilities";
import { ArgumentParserBase, ICommonArguments } from "./ArgumentParserBase";

interface IBaseScanArguments extends ICommonArguments {
  appVersion: string;
  branchName: string;
  branchURI: string;
  buildURI: string;
  buildVersion: string;
  commitHash: string;
  contributingDeveloperId: string;
  contributingDeveloperSource: ContributingDeveloperSource;
  contributingDeveloperSourceName: string;
  integrationName: IntegrationName;
  integrationType: IntegrationType;
  onFailure: OnFailure;
  operatingEnvironment: string;
  projectName: string;
  exportFormat: AttributionFormatEnum;
  exportFileType: AttributionFileTypeEnum;
}

class AnalysisArgumentParser extends ArgumentParserBase {
  public scanType: ScanType;
  public scriptVersion: string;
  public integrationName: IntegrationName;
  public integrationType: IntegrationType;

  constructor(
    integrationName: IntegrationName,
    integrationType: IntegrationType,
    scanType: ScanType,
    scriptVersion: string,
  ) {
    super(`SOOS ${scanType}`);

    this.integrationName = integrationName;
    this.integrationType = integrationType;
    this.scanType = scanType;
    this.scriptVersion = scriptVersion;

    this.addBaseScanArguments();
  }

  static create(
    integrationName: IntegrationName,
    integrationType: IntegrationType,
    scanType: ScanType,
    scriptVersion: string,
  ): AnalysisArgumentParser {
    return new AnalysisArgumentParser(integrationName, integrationType, scanType, scriptVersion);
  }

  addBaseScanArguments() {
    this.addArgument("--appVersion", "App Version", { internal: true, required: true });
    this.addArgument("--branchName", "The name of the branch from the SCM System.");
    this.addArgument("--branchURI", "The URI to the branch from the SCM System.");
    this.addArgument("--buildURI", "URI to CI build info.");
    this.addArgument("--buildVersion", "Version of application build artifacts.");
    this.addArgument("--commitHash", "The commit hash value from the SCM System.");
    this.addArgument("--contributingDeveloperId", "Contributing Developer ID", { internal: true });
    this.addEnumArgument(
      "--contributingDeveloperSource",
      ContributingDeveloperSource,
      "Contributing Developer Source",
      { defaultValue: ContributingDeveloperSource.Unknown, internal: true },
    );
    this.addArgument("--contributingDeveloperSourceName", "Contributing Developer Source Name", {
      internal: true,
    });
    this.addEnumArgument(
      "--exportFileType",
      AttributionFileTypeEnum,
      "The report export file type (NOTE: not all file types are available for all export formats).",
      { defaultValue: AttributionFileTypeEnum.Unknown },
    );
    this.addEnumArgument("--exportFormat", AttributionFormatEnum, "The report export format.", {
      defaultValue: AttributionFormatEnum.Unknown,
    });
    this.addEnumArgument(
      "--onFailure",
      OnFailure,
      "Action to perform when the scan fails. Options: fail_the_build, continue_on_failure.",
      { defaultValue: OnFailure.Continue },
    );
    this.addArgument(
      "--operatingEnvironment",
      "Set Operating environment for information purposes only.",
    );
    this.addArgument(
      "--projectName",
      "Project Name - this is what will be displayed in the SOOS app.",
      {
        required: true,
        argParser: (value: string) => {
          return ensureNonEmptyValue(value, "projectName");
        },
      },
    );
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

  protected ensureValidExportArguments<T extends OptionValues>(args: T): void {
    const exportKbMessage = "See https://kb.soos.io/project-exports-and-reports for valid options.";
    const hasExportFormat =
      !isNil(args.exportFormat) && args.exportFormat !== AttributionFormatEnum.Unknown;
    const hasExportFileType =
      !isNil(args.exportFileType) && args.exportFormat !== AttributionFileTypeEnum.Unknown;

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

  override parseArguments<T extends OptionValues>(argv?: string[]) {
    const args = super.parseArguments<T>(argv);
    this.ensureValidExportArguments(args);
    return args;
  }
}

export default AnalysisArgumentParser;

export { IBaseScanArguments, ICommonArguments };
