import {
  AttributionFileTypeEnum,
  AttributionFormatEnum,
  ContributingDeveloperSource,
  IntegrationName,
  IntegrationType,
  OnFailure,
  ScanType,
} from "../enums";
import { ensureNonEmptyValue } from "../utilities";
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
    this.addInternalArgument("--appVersion", "App Version");
    this.addArgument("--branchName", "The name of the branch from the SCM System.");
    this.addArgument("--branchURI", "The URI to the branch from the SCM System.");
    this.addArgument("--buildURI", "URI to CI build info.");
    this.addArgument("--buildVersion", "Version of application build artifacts.");
    this.addArgument("--commitHash", "The commit hash value from the SCM System.");
    this.addInternalArgument("--contributingDeveloperId", "Contributing Developer ID");
    this.addEnumArgument(
      "--contributingDeveloperSource",
      ContributingDeveloperSource,
      "Contributing Developer Source",
      ContributingDeveloperSource.Unknown,
      { internal: true },
    );
    this.addInternalArgument(
      "--contributingDeveloperSourceName",
      "Contributing Developer Source Name",
    );
    this.addEnumArgument(
      "--exportFileType",
      AttributionFileTypeEnum,
      "The report export file type (NOTE: not all file types are available for all export formats).",
      AttributionFileTypeEnum.Unknown,
    );
    this.addEnumArgument(
      "--exportFormat",
      AttributionFormatEnum,
      "The report export format.",
      AttributionFormatEnum.Unknown,
    );
    this.addEnumArgument(
      "--onFailure",
      OnFailure,
      "Action to perform when the scan fails. Options: fail_the_build, continue_on_failure.",
      OnFailure.Continue,
    );
    this.addArgument(
      "--operatingEnvironment",
      "Set Operating environment for information purposes only.",
    );
    this.addArgument(
      "--projectName",
      "Project Name - this is what will be displayed in the SOOS app.",
      (value: string) => {
        return ensureNonEmptyValue(value, "projectName");
      },
    );
  }
}

export default AnalysisArgumentParser;

export { IBaseScanArguments, ICommonArguments };
