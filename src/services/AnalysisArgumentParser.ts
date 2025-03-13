import { Command, program } from "commander";
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
    argumentParser: Command,
    integrationName: IntegrationName,
    integrationType: IntegrationType,
    scanType: ScanType,
    scriptVersion: string,
  ) {
    super(argumentParser);
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
    return new AnalysisArgumentParser(
      program.description(`SOOS ${scanType}`),
      integrationName,
      integrationType,
      scanType,
      scriptVersion,
    );
  }

  addBaseScanArguments() {
    this.argumentParser.option("--appVersion", "App Version - Intended for internal use only.");
    this.argumentParser.option("--branchName", "The name of the branch from the SCM System.");
    this.argumentParser.option("--branchURI", "The URI to the branch from the SCM System.");
    this.argumentParser.option("--buildURI", "URI to CI build info.");
    this.argumentParser.option("--buildVersion", "Version of application build artifacts.");
    this.argumentParser.option("--commitHash", "The commit hash value from the SCM System.");
    this.argumentParser.option(
      "--contributingDeveloperId",
      "Contributing Developer ID - Intended for internal use only.",
    );
    this.addEnumArgument(
      "--contributingDeveloperSource",
      ContributingDeveloperSource,
      "Contributing Developer Source - Intended for internal use only.",
      ContributingDeveloperSource.Unknown,
    );
    this.argumentParser.option(
      "--contributingDeveloperSourceName",
      "Contributing Developer Source Name - Intended for internal use only.",
    );
    this.addEnumArgument(
      "--onFailure",
      OnFailure,
      "Action to perform when the scan fails. Options: fail_the_build, continue_on_failure.",
      OnFailure.Continue,
    );
    this.argumentParser.option(
      "--operatingEnvironment",
      "Set Operating environment for information purposes only.",
    );
    this.argumentParser.option(
      "--projectName",
      "Project Name - this is what will be displayed in the SOOS app.",
      (value: string) => {
        return ensureNonEmptyValue(value, "projectName");
      },
    );

    this.addEnumArgument(
      "--exportFormat",
      AttributionFormatEnum,
      "The report export format.",
      AttributionFormatEnum.Unknown,
    );

    this.addEnumArgument(
      "--exportFileType",
      AttributionFileTypeEnum,
      "The report export file type (NOTE: not all file types are available for all export formats).",
      AttributionFileTypeEnum.Unknown,
    );
  }
}

export default AnalysisArgumentParser;

export { IBaseScanArguments, ICommonArguments };
