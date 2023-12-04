import StringUtilities from "../StringUtilities";
import SOOSAnalysisApiClient, {
  ICreateScanRequestContributingDeveloperAudit,
  ICreateScanResponse,
} from "../api/SOOSAnalysisApiClient";
import SOOSProjectsApiClient from "../api/SOOSProjectsApiClient";
import { SOOS_CONSTANTS } from "../constants";
import {
  ContributingDeveloperSource,
  IntegrationName,
  OutputFormat,
  ScanStatus,
  ScanType,
} from "../enums";
import { soosLogger } from "../logging";
import { sleep } from "../utilities";
import * as FileSystem from "fs";
import * as Path from "path";

interface IGenerateFormattedOutputParams {
  clientId: string;
  projectHash: string;
  projectName: string;
  branchHash: string;
  scanType: ScanType;
  analysisId: string;
  outputFormat: OutputFormat;
  sourceCodePath: string;
  workingDirectory: string;
}

interface IStartScanParams {
  clientId: string;
  projectHash: string;
  analysisId: string;
  scanType: ScanType;
  scanUrl: string;
}

interface IWaitForScanToFinishParams {
  scanStatusUrl: string;
  scanUrl: string;
}

interface ISetupScanParams {
  clientId: string;
  projectName: string;
  branchName: string;
  commitHash: string;
  buildVersion: string;
  buildUri: string;
  branchUri: string;
  integrationType: string;
  operatingEnvironment: string;
  integrationName: IntegrationName;
  appVersion: string;
  scriptVersion: string;
  contributingDeveloperAudit: ICreateScanRequestContributingDeveloperAudit[];
  scanType: ScanType;
  toolName?: string;
  toolVersion?: string;
}

interface IUpdateScanStatusParams {
  clientId: string;
  projectHash: string;
  branchHash: string;
  scanType: ScanType;
  analysisId: string;
  status: ScanStatus;
  message: string;
}

const integrationNameToEnvVariable: Record<IntegrationName, string> = {
  [IntegrationName.AWSCodeBuild]: "CODEBUILD_BUILD_INITIATOR",
  [IntegrationName.Bamboo]: "bamboo_planRepository_1_username",
  [IntegrationName.BitBucket]: "BITBUCKET_STEP_TRIGGERER_UUID",
  [IntegrationName.CircleCI]: "CIRCLE_USERNAME",
  [IntegrationName.CodeShip]: "CI_COMMITTER_USERNAME",
  [IntegrationName.GithubActions]: "GITHUB_ACTOR",
  [IntegrationName.GitLab]: "GITLAB_USER_LOGIN",
  [IntegrationName.Jenkins]: "CHANGE_AUTHOR",
  [IntegrationName.Script]: "SOOS_CONTRIBUTING_DEVELOPER",
  [IntegrationName.TeamCity]: "TEAMCITY_BUILD_TRIGGEREDBY_USERNAME",
  [IntegrationName.TravisCI]: "TRAVIS_COMMIT",
};

class AnalysisService {
  public analysisApiClient: SOOSAnalysisApiClient;
  public projectsApiClient: SOOSProjectsApiClient;

  constructor(analysisApiClient: SOOSAnalysisApiClient, projectsApiClient: SOOSProjectsApiClient) {
    this.analysisApiClient = analysisApiClient;
    this.projectsApiClient = projectsApiClient;
  }

  static create(apiKey: string, apiURL: string): AnalysisService {
    const analysisApiClient = new SOOSAnalysisApiClient(apiKey, apiURL);
    const projectsApiClient = new SOOSProjectsApiClient(
      apiKey,
      apiURL.replace("api.", "api-projects."),
    );

    return new AnalysisService(analysisApiClient, projectsApiClient);
  }

  async setupScan({
    clientId,
    projectName,
    branchName,
    commitHash,
    buildVersion,
    buildUri,
    branchUri,
    integrationType,
    operatingEnvironment,
    integrationName,
    appVersion,
    scriptVersion,
    contributingDeveloperAudit,
    scanType,
    toolName,
    toolVersion,
  }: ISetupScanParams): Promise<ICreateScanResponse> {
    soosLogger.info(`Starting SOOS ${scanType} Analysis`);
    soosLogger.info(`Creating scan for project '${projectName}'...`);
    soosLogger.info(`Branch Name: ${branchName}`);

    if (integrationName !== IntegrationName.Script && contributingDeveloperAudit.length === 0) {
      soosLogger.info(`Integration Name: ${integrationName}`);
      const envVariableName = integrationNameToEnvVariable[integrationName];
      if (envVariableName) {
        const contributingDeveloper = process.env[envVariableName];
        if (contributingDeveloper) {
          contributingDeveloperAudit.push({
            source: ContributingDeveloperSource.EnvironmentVariable,
            sourceName: envVariableName,
            contributingDeveloperId: contributingDeveloper,
          });
        }
      }
    }

    const result = await this.analysisApiClient.createScan({
      clientId: clientId,
      projectName: projectName,
      commitHash: commitHash,
      branch: branchName,
      buildVersion: buildVersion,
      buildUri: buildUri,
      branchUri: branchUri,
      integrationType: integrationType,
      operatingEnvironment: operatingEnvironment,
      integrationName: integrationName,
      appVersion: appVersion,
      scriptVersion: scriptVersion,
      contributingDeveloperAudit: contributingDeveloperAudit,
      scanType: scanType,
      toolName: toolName,
      toolVersion: toolVersion,
    });

    soosLogger.info(`Project Hash: ${result.projectHash}`);
    soosLogger.info(`Branch Hash: ${result.branchHash}`);
    soosLogger.info(`Scan Id: ${result.analysisId}`);
    soosLogger.info("Scan created successfully.");

    return result;
  }

  async startScan({
    clientId,
    projectHash,
    analysisId,
    scanType,
    scanUrl,
  }: IStartScanParams): Promise<void> {
    soosLogger.info(`Starting ${scanType} Analysis scan`);
    await this.analysisApiClient.startScan({
      clientId: clientId,
      projectHash: projectHash,
      analysisId: analysisId,
    });
    soosLogger.info(`Analysis scan started successfully, to see the results visit: ${scanUrl}`);
  }

  async waitForScanToFinish({
    scanStatusUrl,
    scanUrl,
  }: IWaitForScanToFinishParams): Promise<ScanStatus> {
    const scanStatus = await this.analysisApiClient.getScanStatus({
      scanStatusUrl: scanStatusUrl,
    });

    if (!scanStatus.isComplete) {
      soosLogger.info(`${StringUtilities.fromCamelToTitleCase(scanStatus.status)}...`);
      await sleep(SOOS_CONSTANTS.Status.DelayTime);
      return await this.waitForScanToFinish({ scanStatusUrl, scanUrl });
    }

    if (scanStatus.errors.length > 0) {
      soosLogger.group("Errors:");
      soosLogger.warn(JSON.stringify(scanStatus.errors, null, 2));
      soosLogger.groupEnd();
    }

    if (scanStatus.isSuccess) {
      scanStatus.vulnerabilities > 0 || scanStatus.violations > 0;
    }

    let statusMessage = `Scan ${scanStatus.isSuccess ? "passed" : "failed"}`;
    if (scanStatus.hasIssues) {
      const vulnerabilities = StringUtilities.pluralizeTemplate(
        scanStatus.vulnerabilities,
        "vulnerability",
        "vulnerabilities",
      );

      const violations = StringUtilities.pluralizeTemplate(scanStatus.violations, "violation");

      statusMessage = statusMessage.concat(
        `${
          scanStatus.isSuccess ? ", but had" : " because of"
        } ${vulnerabilities} and ${violations}`,
      );
    }

    const resultMessage = `${statusMessage}. View the results at: ${scanUrl}`;
    soosLogger.info(resultMessage);
    return scanStatus.status;
  }

  async generateFormattedOutput({
    clientId,
    projectHash,
    projectName,
    branchHash,
    scanType,
    analysisId,
    outputFormat,
    sourceCodePath,
    workingDirectory,
  }: IGenerateFormattedOutputParams): Promise<void> {
    soosLogger.info(`Generating ${outputFormat} report ${projectName}...`);
    const output = await this.analysisApiClient.getFormattedScanResult({
      clientId: clientId,
      projectHash: projectHash,
      branchHash: branchHash,
      scanType: scanType,
      scanId: analysisId,
      outputFormat: outputFormat,
    });
    if (output) {
      soosLogger.info(`${outputFormat} report generated successfully.`);
      soosLogger.info(`Output ('${outputFormat}' format):`);
      soosLogger.info(JSON.stringify(output, null, 2));
      if (sourceCodePath) {
        soosLogger.info(
          `Writing ${outputFormat} report to ${Path.join(
            sourceCodePath,
            SOOS_CONSTANTS.Files.SarifOutput,
          )}`,
        );
        FileSystem.writeFile(
          `${workingDirectory}/${SOOS_CONSTANTS.Files.SarifOutput}`,
          JSON.stringify(output, null, 2),
          (error) => {
            if (error) {
              soosLogger.error(error);
            }
          },
        );
      }
    }
  }

  async updateScanStatus({
    clientId,
    projectHash,
    branchHash,
    scanType,
    analysisId,
    status,
    message,
  }: IUpdateScanStatusParams): Promise<void> {
    await this.analysisApiClient.updateScanStatus({
      clientId: clientId,
      projectHash: projectHash,
      branchHash: branchHash,
      scanType: scanType,
      scanId: analysisId,
      status: status,
      message: message,
    });
    if (status === ScanStatus.Incomplete || status === ScanStatus.Error) soosLogger.error(message);
  }
}

export default AnalysisService;
