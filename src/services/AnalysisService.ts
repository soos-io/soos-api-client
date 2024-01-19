import SOOSAnalysisApiClient, {
  ICreateScanRequestContributingDeveloperAudit,
  ICreateScanResponse,
} from "../api/SOOSAnalysisApiClient";
import SOOSProjectsApiClient from "../api/SOOSProjectsApiClient";
import SOOSUserApiClient, { IApplicationStatusMessage } from "../api/SOOSUserApiClient";
import { SOOS_CONSTANTS } from "../constants";
import {
  ContributingDeveloperSource,
  IntegrationName,
  IntegrationType,
  OutputFormat,
  ScanStatus,
  ScanType,
  SeverityEnum,
} from "../enums";
import { soosLogger } from "../logging";
import {
  StringUtilities,
  formatBytes,
  getVulnerabilitiesByScanType,
  isNil,
  sleep,
} from "../utilities";
import * as FileSystem from "fs";
import * as Path from "path";
import FormData from "form-data";
import * as Glob from "glob";
import SOOSHooksApiClient from "../api/SOOSHooksApiClient";

interface IGenerateFormattedOutputParams {
  clientId: string;
  projectHash: string;
  projectName: string;
  branchHash: string;
  scanType: ScanType;
  analysisId: string;
  outputFormat: OutputFormat;
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
  scanType: ScanType;
}

interface ISetupScanParams {
  clientId: string;
  projectName: string;
  branchName: string;
  commitHash: string;
  buildVersion: string;
  buildUri: string;
  branchUri: string;
  integrationType: IntegrationType;
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
  scanStatusUrl?: string;
}

const integrationNameToEnvVariable: Record<IntegrationName, string> = {
  [IntegrationName.AzureDevOps]: "Build.RequestedFor",
  [IntegrationName.AWSCodeBuild]: "CODEBUILD_BUILD_INITIATOR",
  [IntegrationName.Bamboo]: "bamboo_planRepository_1_username",
  [IntegrationName.BitBucket]: "BITBUCKET_STEP_TRIGGERER_UUID",
  [IntegrationName.CircleCI]: "CIRCLE_USERNAME",
  [IntegrationName.CodeShip]: "CI_COMMITTER_USERNAME",
  [IntegrationName.GithubActions]: "GITHUB_ACTOR",
  [IntegrationName.GitLab]: "GITLAB_USER_LOGIN",
  [IntegrationName.Jenkins]: "CHANGE_AUTHOR",
  [IntegrationName.SoosCsa]: "SOOS_CONTRIBUTING_DEVELOPER",
  [IntegrationName.SoosDast]: "SOOS_CONTRIBUTING_DEVELOPER",
  [IntegrationName.SoosSast]: "SOOS_CONTRIBUTING_DEVELOPER",
  [IntegrationName.SoosSca]: "SOOS_CONTRIBUTING_DEVELOPER",
  [IntegrationName.SoosSbom]: "SOOS_CONTRIBUTING_DEVELOPER",
  [IntegrationName.TeamCity]: "TEAMCITY_BUILD_TRIGGEREDBY_USERNAME",
  [IntegrationName.TravisCI]: "TRAVIS_COMMIT",
};

const GeneratedScanTypes = [ScanType.CSA, ScanType.SBOM, ScanType.SCA];

class AnalysisService {
  public analysisApiClient: SOOSAnalysisApiClient;
  public projectsApiClient: SOOSProjectsApiClient;
  public userApiClient: SOOSUserApiClient;
  public hooksApiClient: SOOSHooksApiClient;

  constructor(
    analysisApiClient: SOOSAnalysisApiClient,
    projectsApiClient: SOOSProjectsApiClient,
    userApiClient: SOOSUserApiClient,
    hooksApiClient: SOOSHooksApiClient,
  ) {
    this.analysisApiClient = analysisApiClient;
    this.projectsApiClient = projectsApiClient;
    this.userApiClient = userApiClient;
    this.hooksApiClient = hooksApiClient;
  }

  static create(apiKey: string, apiURL: string): AnalysisService {
    const analysisApiClient = new SOOSAnalysisApiClient(apiKey, apiURL);
    const projectsApiClient = new SOOSProjectsApiClient(
      apiKey,
      apiURL.replace("api.", "api-projects."),
    );
    const userApiClient = new SOOSUserApiClient(apiKey, apiURL.replace("api.", "api-user."));
    const hooksApiClient = new SOOSHooksApiClient(apiKey, apiURL.replace("api.", "api-hooks."));

    return new AnalysisService(analysisApiClient, projectsApiClient, userApiClient, hooksApiClient);
  }

  private logStatusMessage(message: IApplicationStatusMessage | null): void {
    if (message) {
      switch (message.severity) {
        case SeverityEnum.Unknown:
        case SeverityEnum.None:
        case SeverityEnum.Info:
        case SeverityEnum.Low:
          soosLogger.info(message.message);
          break;
        case SeverityEnum.Medium:
        case SeverityEnum.High:
          soosLogger.warn(message.message);
          break;
        case SeverityEnum.Critical:
          soosLogger.error(message.message);
          break;
      }

      if (message.url) {
        const linkText = message.linkText ? `[${message.linkText}]` : "";
        soosLogger.info(`${linkText}(${message.url})`);
      }
    }
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
    soosLogger.info("Checking status...");
    const applicationStatus = await this.userApiClient.getApplicationStatus(clientId);
    this.logStatusMessage(applicationStatus.statusMessage);
    this.logStatusMessage(applicationStatus.clientMessage);
    soosLogger.logLineSeparator();
    soosLogger.info(`Starting SOOS ${scanType} Analysis`);
    soosLogger.info(`Creating scan for project '${projectName}'...`);
    soosLogger.info(`Branch Name: ${branchName}`);

    if (contributingDeveloperAudit.length === 0) {
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
    scanType,
  }: IWaitForScanToFinishParams): Promise<ScanStatus> {
    const scanStatus = await this.analysisApiClient.getScanStatus({
      scanStatusUrl: scanStatusUrl,
    });

    if (!scanStatus.isComplete) {
      soosLogger.info(`${StringUtilities.fromCamelToTitleCase(scanStatus.status)}...`);
      await sleep(SOOS_CONSTANTS.Status.DelayTime);
      return await this.waitForScanToFinish({ scanStatusUrl, scanUrl, scanType });
    }

    if (scanStatus.errors.length > 0) {
      soosLogger.group("Errors:");
      soosLogger.warn(JSON.stringify(scanStatus.errors, null, 2));
      soosLogger.groupEnd();
    }

    const vulnerabilities = StringUtilities.pluralizeTemplate(
      getVulnerabilitiesByScanType(scanStatus.issues, scanType) ?? 0,
      "vulnerability",
      "vulnerabilities",
    );

    const violations = StringUtilities.pluralizeTemplate(
      scanStatus.issues?.Violation?.count ?? 0,
      "violation",
    );

    const isGeneratedScanType = GeneratedScanTypes.includes(scanType);

    const substitutions = isGeneratedScanType
      ? StringUtilities.pluralizeTemplate(
          scanStatus.issues?.DependencySubstitution?.count ?? 0,
          "dependency substitution",
        )
      : "";

    const typos = isGeneratedScanType
      ? StringUtilities.pluralizeTemplate(
          scanStatus.issues?.DependencyTypo?.count ?? 0,
          "dependency typo",
        )
      : "";

    soosLogger.always(
      `Scan ${scanStatus.isSuccess ? "passed" : "failed"}${
        scanStatus.isSuccess ? ", with" : " because of"
      } (${vulnerabilities}) (${violations})${substitutions ? ` (${substitutions})` : ""}${
        typos ? ` (${typos})` : ""
      }.`,
    );
    soosLogger.info(`View the results at: ${scanUrl}`);
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
      if (workingDirectory) {
        soosLogger.info(
          `Writing ${outputFormat} report to ${Path.join(
            workingDirectory,
            SOOS_CONSTANTS.Files.SarifOutput,
          )}`,
        );
        FileSystem.writeFileSync(
          Path.join(workingDirectory, SOOS_CONSTANTS.Files.SarifOutput),
          JSON.stringify(output, null, 2),
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
    scanStatusUrl,
  }: IUpdateScanStatusParams): Promise<void> {
    if (!isNil(scanStatusUrl)) {
      const scanStatus = await this.analysisApiClient.getScanStatus({
        scanStatusUrl: scanStatusUrl,
      });
      if (scanStatus.isComplete) return;
    }

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

  async findAnalysisFiles(
    scanType: ScanType,
    path: string,
    pattern: string,
    filesToExclude: string[] | null = null,
    directoriesToExclude: string[] | null = null,
    maxFiles: number = 0,
  ): Promise<{ filePaths: string[]; hasMoreThanMaximumFiles: boolean }> {
    process.chdir(path);
    soosLogger.info(`Searching for ${scanType} files from ${path}...`);
    const files = Glob.sync(pattern, {
      ignore: [
        ...(filesToExclude || []),
        ...(directoriesToExclude || []),
        SOOS_CONSTANTS.Files.SoosDirectoryExclusionGlobPattern,
      ],
      nocase: true,
    });

    const matchingFiles = files.map((x) => Path.resolve(x));

    soosLogger.info(`${matchingFiles.length} files found matching pattern '${pattern}'.`);

    matchingFiles.flat().map((filePath) => {
      const filename = Path.basename(filePath);
      const fileStats = FileSystem.statSync(filePath);
      const fileSize = formatBytes(fileStats.size);
      soosLogger.info(
        `Found ${scanType} file '${filename}' (${fileSize}) at location '${filePath}'.`,
      );
    });

    if (maxFiles < 1) {
      return { filePaths: matchingFiles, hasMoreThanMaximumFiles: false };
    }

    const hasMoreThanMaximumFiles = matchingFiles.length > maxFiles;
    const filesToUpload = matchingFiles.slice(0, maxFiles);

    if (hasMoreThanMaximumFiles) {
      const filesToSkip = matchingFiles.slice(maxFiles);
      const filesDetectedString = StringUtilities.pluralizeTemplate(
        matchingFiles.length,
        "file was",
        "files were",
      );
      const filesSkippedString = StringUtilities.pluralizeTemplate(filesToSkip.length, "file");
      soosLogger.info(
        `The maximum number of ${scanType} files per scan is ${maxFiles}. ${filesDetectedString} detected, and ${filesSkippedString} will be not be uploaded. \n`,
        `The following files will not be included in the scan: \n`,
        filesToSkip.map((file) => `  "${Path.basename(file)}": "${file}"`).join("\n"),
      );
    }

    return { filePaths: filesToUpload, hasMoreThanMaximumFiles };
  }

  async getAnalysisFilesAsFormData(
    analysisFilePaths: string[],
    workingDirectory: string,
  ): Promise<FormData> {
    const analysisFiles = analysisFilePaths.map((filePath) => {
      return {
        name: Path.basename(filePath),
        path: filePath,
      };
    });
    const formData = analysisFiles.reduce((formDataAcc: FormData, analysisFile, index) => {
      const fileParts = analysisFile.path.replace(workingDirectory, "").split(Path.sep);
      const parentFolder =
        fileParts.length >= 2 ? fileParts.slice(0, fileParts.length - 1).join(Path.sep) : "";
      const suffix = index > 0 ? index : "";
      const fileReadStream = FileSystem.createReadStream(analysisFile.path, {
        encoding: SOOS_CONSTANTS.FileUploads.Encoding,
      });
      formDataAcc.append(`file${suffix}`, fileReadStream);
      formDataAcc.append(`parentFolder${suffix}`, parentFolder);

      return formDataAcc;
    }, new FormData());

    return formData;
  }
}

export { GeneratedScanTypes };
export default AnalysisService;
