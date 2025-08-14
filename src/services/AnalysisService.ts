import {
  AttributionFileTypeEnum,
  AttributionFormatEnum,
  AttributionStatusEnum,
  FileMatchTypeEnum,
  HashAlgorithmEnum,
  HashEncodingEnum,
} from "./../enums";
import SOOSAnalysisApiClient, {
  ICreateScanRequestContributingDeveloperAudit,
  ICreateScanResponse,
  IScanStatusResponse,
  IUploadManifestFilesResponse,
} from "../api/SOOSAnalysisApiClient";
import SOOSProjectsApiClient from "../api/SOOSProjectsApiClient";
import SOOSUserApiClient, { IApplicationStatusMessage } from "../api/SOOSUserApiClient";
import { SOOS_CONSTANTS } from "../constants";
import {
  ContributingDeveloperSource,
  IntegrationName,
  IntegrationType,
  PackageManagerType,
  ScanStatus,
  ScanType,
  SeverityEnum,
} from "../enums";
import { soosLogger } from "../logging";
import {
  FileUtilities,
  StringUtilities,
  checkNodeVersion,
  formatBytes,
  generateFileHash,
  isNil,
  sleep,
} from "../utilities";
import * as FileSystem from "fs";
import * as Path from "path";
import FormData from "form-data";
import * as Glob from "glob";
import SOOSHooksApiClient from "../api/SOOSHooksApiClient";
import SOOSAttributionApiClient, { IAttributionStatusModel } from "../api/SOOSAttributionApiClient";

interface IGenerateAttributionOutputParams {
  clientId: string;
  projectHash: string;
  projectName: string;
  branchHash: string;
  analysisId: string;
  format: AttributionFormatEnum;
  fileType: AttributionFileTypeEnum;
  includeDependentProjects?: boolean;
  includeVulnerabilities?: boolean;
  includeOriginalSbom?: boolean;
  workingDirectory: string;
}

interface IWaitForAttributionToFinishParams {
  clientId: string;
  projectHash: string;
  branchHash: string;
  scanId: string;
  attributionId: string;
}

interface IManifestFile {
  packageManager: string;
  name: string;
  path: string;
}

interface ISoosFileHash {
  filename: string;
  path: string;
  digests: Array<ISoosDigest>;
}

interface ISoosDigest {
  hashAlgorithm: HashAlgorithmEnum;
  digest: string;
}

interface ISoosHashesManifest {
  packageManager: string;
  fileHashes: Array<ISoosFileHash>;
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
  isFirstCheckComplete?: boolean;
}

interface ISetupScanParams {
  clientId: string;
  projectName: string;
  branchName: string | null;
  commitHash: string | null;
  buildVersion: string | null;
  buildUri: string | null;
  branchUri: string | null;
  integrationType: IntegrationType;
  operatingEnvironment: string;
  integrationName: IntegrationName;
  appVersion: string | null;
  scriptVersion: string | null;
  contributingDeveloperAudit?: ICreateScanRequestContributingDeveloperAudit[];
  scanType: ScanType;
  toolName?: string | null;
  toolVersion?: string | null;
  commandLine?: string | null;
  scanMode?: string | null;
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

/*
  Environment Variable References
  Azure DevOps: https://learn.microsoft.com/en-us/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml
  AWS CodeBuild: https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html
  Bamboo: https://confluence.atlassian.com/bamboo/bamboo-variables-289277087.html
  CicleCI: https://circleci.com/docs/variables/#built-in-environment-variables
  Codeship: https://docs.cloudbees.com/docs/cloudbees-codeship/latest/pro-builds-and-configuration/environment-variables
  GitHub Actions: https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables
  Jenkins: https://devopsqa.wordpress.com/2019/11/19/list-of-available-jenkins-environment-variables/
  TeamCity: https://www.jetbrains.com/help/teamcity/predefined-build-parameters.html#Predefined+Server+Build+Parameters
  TravisCI: https://docs.travis-ci.com/user/environment-variables
*/

const contributingDeveloperEnvironmentVariables: Array<string> = [
  // AzureDevOps
  "Build_RequestedFor",
  "Build_RequestedForEmail",

  // AWS CodeBuild"
  "CODEBUILD_BUILD_INITIATOR",
  "CODEBUILD_INITIATOR",

  // Bamboo"
  "bamboo_planRepository_1_username",
  "bamboo_ManualBuildTriggerReason_userName",

  // Bitbucket
  "BITBUCKET_STEP_TRIGGERER_UUID",

  // CicleCI
  "CIRCLE_USERNAME",
  "CIRCLE_PR_USERNAME",

  // Codeship
  "CI_COMMITTER_USERNAME",
  "CI_COMMITTER_EMAIL",

  // GitHub Actions
  "GITHUB_ACTOR",
  "GITHUB_TRIGGERING_ACTOR",

  // Jenkins
  "CHANGE_AUTHOR",
  "CHANGE_AUTHOR_EMAIL",
  "GIT_COMMITTER_NAME",
  "GIT_COMMITTER_EMAIL",
  "GIT_AUTHOR_NAME",
  "GIT_AUTHOR_EMAIL",

  // SOOS
  "SOOS_CONTRIBUTING_DEVELOPER",

  // TeamCity
  "TEAMCITY_BUILD_TRIGGEREDBY_USERNAME",

  // TravisCI
  "TRAVIS_JOB_RESTARTED_BY",

  // Visual Studio/Code
  "SOOS_CONTRIBUTING_DEVELOPER",
];

const GeneratedScanTypes = [ScanType.CSA, ScanType.SBOM, ScanType.SCA];

class AnalysisService {
  public analysisApiClient: SOOSAnalysisApiClient;
  public attributionApiClient: SOOSAttributionApiClient;
  public projectsApiClient: SOOSProjectsApiClient;
  public userApiClient: SOOSUserApiClient;
  public hooksApiClient: SOOSHooksApiClient;

  constructor(
    analysisApiClient: SOOSAnalysisApiClient,
    attributionApiClient: SOOSAttributionApiClient,
    projectsApiClient: SOOSProjectsApiClient,
    userApiClient: SOOSUserApiClient,
    hooksApiClient: SOOSHooksApiClient,
  ) {
    this.analysisApiClient = analysisApiClient;
    this.attributionApiClient = attributionApiClient;
    this.projectsApiClient = projectsApiClient;
    this.userApiClient = userApiClient;
    this.hooksApiClient = hooksApiClient;
  }

  static create(apiKey: string, apiURL: string): AnalysisService {
    const analysisApiClient = new SOOSAnalysisApiClient(apiKey, apiURL);
    const attributionApiClient = new SOOSAttributionApiClient(apiKey, apiURL);
    const projectsApiClient = new SOOSProjectsApiClient(
      apiKey,
      apiURL.replace("api.", "api-projects."),
    );
    const userApiClient = new SOOSUserApiClient(apiKey, apiURL.replace("api.", "api-user."));
    const hooksApiClient = new SOOSHooksApiClient(apiKey, apiURL.replace("api.", "api-hooks."));

    return new AnalysisService(
      analysisApiClient,
      attributionApiClient,
      projectsApiClient,
      userApiClient,
      hooksApiClient,
    );
  }

  private logStatusMessage(message: IApplicationStatusMessage | null): void {
    if (message) {
      switch (message.severity) {
        case SeverityEnum.Unknown:
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
    commandLine,
    scanMode,
  }: ISetupScanParams): Promise<ICreateScanResponse> {
    const nodeVersion = checkNodeVersion();

    soosLogger.info("Checking SOOS App status...");
    const applicationStatus = await this.userApiClient.getApplicationStatus(clientId);
    this.logStatusMessage(applicationStatus.statusMessage);
    this.logStatusMessage(applicationStatus.clientMessage);

    soosLogger.info(`Creating scan for project '${projectName}'...`);
    if (branchName) {
      soosLogger.info(`Branch Name: ${branchName}`);
    }

    const createScanAudit =
      contributingDeveloperAudit === undefined || contributingDeveloperAudit.length === 0
        ? contributingDeveloperEnvironmentVariables
            .map((ev) => {
              const environmentVariableValue = process.env[ev];
              return environmentVariableValue && environmentVariableValue.length > 0
                ? {
                    source: ContributingDeveloperSource.EnvironmentVariable,
                    sourceName: ev,
                    contributingDeveloperId: environmentVariableValue,
                  }
                : null;
            })
            .filter((a) => a !== null)
        : contributingDeveloperAudit;

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
      nodeVersion: nodeVersion,
      scriptVersion: scriptVersion,
      contributingDeveloperAudit: createScanAudit,
      scanType: scanType,
      toolName: toolName,
      toolVersion: toolVersion,
      commandLine: commandLine,
      scanMode: scanMode,
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
  }: IStartScanParams): Promise<void> {
    soosLogger.info(`Starting ${scanType} Analysis Scan`);
    await this.analysisApiClient.startScan({
      clientId: clientId,
      projectHash: projectHash,
      analysisId: analysisId,
    });
    soosLogger.info("Analysis scan started successfully... waiting for the scan");
  }

  async waitForScanToFinish({
    scanStatusUrl,
    scanUrl,
    scanType,
  }: IWaitForScanToFinishParams): Promise<ScanStatus> {
    await sleep(SOOS_CONSTANTS.Status.DelayTime);

    const scanStatus = await this.analysisApiClient.getScanStatus({
      scanStatusUrl: scanStatusUrl,
    });

    if (!scanStatus.isComplete) {
      soosLogger.info(`${StringUtilities.fromCamelToTitleCase(scanStatus.status)}...`);
      return await this.waitForScanToFinish({ scanStatusUrl, scanUrl, scanType }); // recursion
    }

    if (scanStatus.errors.length > 0) {
      soosLogger.group("Errors:");
      soosLogger.warn(JSON.stringify(scanStatus.errors, null, 2));
      soosLogger.groupEnd();
    }

    const output = this.getFinalScanStatusMessage(scanType, scanStatus, scanUrl, true);

    output.map((o) => soosLogger.always(o));

    return scanStatus.status;
  }

  private getColorBySeverity(
    severity: string | undefined,
    count: number,
    colorize: boolean,
  ): string {
    if (!severity) {
      return "";
    }

    if (count === 0) {
      return colorize ? SOOS_CONSTANTS.TerminalColors.Success : "";
    }

    switch (severity.toLocaleLowerCase()) {
      case "info":
        return colorize ? SOOS_CONSTANTS.TerminalColors.Info : "";
      case "low":
        return colorize ? SOOS_CONSTANTS.TerminalColors.Low : "";
      case "medium":
        return colorize ? SOOS_CONSTANTS.TerminalColors.Medium : "";
      case "high":
        return colorize ? SOOS_CONSTANTS.TerminalColors.High : "";
      case "critical":
        return colorize ? SOOS_CONSTANTS.TerminalColors.Critical : "";
      case "unknown":
      default:
        return "";
    }
  }

  private getSuccessColor(colorize: boolean): string {
    return colorize ? SOOS_CONSTANTS.TerminalColors.Success : "";
  }

  private getResetColor(colorize: boolean): string {
    return colorize ? SOOS_CONSTANTS.TerminalColors.Reset : "";
  }

  getFinalScanStatusMessage(
    scanType: ScanType,
    scanStatus: IScanStatusResponse,
    scanUrl: string,
    colorize: boolean | undefined = false,
  ): Array<string> {
    const isGeneratedScanType = GeneratedScanTypes.includes(scanType);
    const output: Array<string> = [];

    output.push(
      `Scan ${scanStatus.isSuccess ? `${this.getSuccessColor(colorize)}passed${this.getResetColor(colorize)}` : `${this.getColorBySeverity("high", 1, colorize)}failed${this.getResetColor(colorize)}`}${
        scanStatus.isSuccess ? " with:" : " because of:"
      }`,
    );

    const maxLengthOfIssueText = 26;
    const padChar = " ";

    if (isGeneratedScanType) {
      const vulnerabilityCount = scanStatus.issues?.Vulnerability?.count ?? 0;
      output.push(
        `${StringUtilities.pluralizeWord(
          vulnerabilityCount,
          "Vulnerability:",
          "Vulnerabilities:",
        ).padEnd(
          maxLengthOfIssueText,
          padChar,
        )}${this.getColorBySeverity(scanStatus.issues?.Vulnerability?.maxSeverity, vulnerabilityCount, colorize)}${vulnerabilityCount}${this.getResetColor(colorize)}`,
      );
    }

    const violationCount = scanStatus.issues?.Violation?.count ?? 0;
    output.push(
      `${StringUtilities.pluralizeWord(violationCount, "Violation:", "Violations:").padEnd(
        maxLengthOfIssueText,
        padChar,
      )}${this.getColorBySeverity(scanStatus.issues?.Violation?.maxSeverity, violationCount, colorize)}${violationCount}${this.getResetColor(colorize)}`,
    );

    if (scanType === ScanType.DAST) {
      const dastCount = scanStatus.issues?.Dast?.count ?? 0;
      output.push(
        `${StringUtilities.pluralizeWord(
          dastCount,
          "Web Vulnerability:",
          "Web Vulnerabilities:",
        ).padEnd(
          maxLengthOfIssueText,
          padChar,
        )}${this.getColorBySeverity(scanStatus.issues?.Dast?.maxSeverity, dastCount, colorize)}${dastCount}${this.getResetColor(colorize)}`,
      );
    }

    if (scanType === ScanType.SAST) {
      const sastCount = scanStatus.issues?.Sast?.count ?? 0;
      output.push(
        `${StringUtilities.pluralizeWord(sastCount, "Code Issue:", "Code Issues:").padEnd(
          maxLengthOfIssueText,
          padChar,
        )}${this.getColorBySeverity(scanStatus.issues?.Sast?.maxSeverity, sastCount, colorize)}${sastCount}${this.getResetColor(colorize)}`,
      );
    }

    if (isGeneratedScanType) {
      const unknownPackageCount = scanStatus.issues?.UnknownPackage?.count ?? 0;
      output.push(
        `${StringUtilities.pluralizeWord(
          unknownPackageCount,
          "Unknown Package:",
          "Unknown Packages:",
        ).padEnd(
          maxLengthOfIssueText,
          padChar,
        )}${this.getColorBySeverity(scanStatus.issues?.UnknownPackage?.maxSeverity, unknownPackageCount, colorize)}${unknownPackageCount}${this.getResetColor(colorize)}`,
      );

      const maliciousPackageCount = scanStatus.issues?.MaliciousPackage?.count ?? 0;
      output.push(
        `${StringUtilities.pluralizeWord(
          maliciousPackageCount,
          "Malicious Package:",
          "Malicious Packages:",
        ).padEnd(
          maxLengthOfIssueText,
          padChar,
        )}${this.getColorBySeverity(scanStatus.issues?.MaliciousPackage?.maxSeverity, maliciousPackageCount, colorize)}${maliciousPackageCount}${this.getResetColor(colorize)}`,
      );
    }

    output.push(`Scan Report: ${scanUrl}`);

    return output;
  }

  async waitForAttributionToFinish({
    clientId,
    projectHash,
    branchHash,
    scanId,
    attributionId,
  }: IWaitForAttributionToFinishParams): Promise<IAttributionStatusModel> {
    const attributionStatus = await this.attributionApiClient.getAttributionStatus({
      clientId,
      projectHash,
      branchHash,
      scanId,
      attributionId,
    });

    if (
      attributionStatus.status === AttributionStatusEnum.Requested ||
      attributionStatus.status === AttributionStatusEnum.InProgress
    ) {
      soosLogger.info(`Waiting for export to complete (${attributionStatus.status})...`);
      await sleep(SOOS_CONSTANTS.Status.DelayTime);
      return await this.waitForAttributionToFinish({
        clientId,
        projectHash,
        branchHash,
        scanId,
        attributionId,
      });
    }

    if (
      attributionStatus.status === AttributionStatusEnum.CompletedWithProblems ||
      attributionStatus.status === AttributionStatusEnum.Failed
    ) {
      soosLogger.warn(JSON.stringify(attributionStatus.message));
    }

    return attributionStatus;
  }

  async generateFormattedOutput({
    clientId,
    projectHash,
    projectName,
    branchHash,
    analysisId,
    format,
    fileType,
    includeDependentProjects,
    includeVulnerabilities,
    includeOriginalSbom,
    workingDirectory,
  }: IGenerateAttributionOutputParams): Promise<void> {
    soosLogger.info(`Generating ${format} report as ${fileType} for ${projectName}...`);

    const attributionStatus = await this.attributionApiClient.createAttributionRequest({
      clientId: clientId,
      projectHash: projectHash,
      branchHash: branchHash,
      scanId: analysisId,
      format,
      fileType,
      includeDependentProjects,
      includeVulnerabilities,
      includeOriginalSbom,
    });

    const finalAttributionStatus = await this.waitForAttributionToFinish({
      clientId,
      projectHash,
      branchHash,
      scanId: analysisId,
      attributionId: attributionStatus.id,
    });

    if (
      finalAttributionStatus.status === AttributionStatusEnum.Completed ||
      finalAttributionStatus.status === AttributionStatusEnum.CompletedWithProblems
    ) {
      const output = await this.attributionApiClient.getScanAttribution({
        clientId,
        projectHash,
        branchHash,
        scanId: analysisId,
        attributionId: finalAttributionStatus.id,
      });

      if (finalAttributionStatus.filename) {
        soosLogger.info(`${format} report generated successfully.`);
        const outputFile = Path.join(workingDirectory, finalAttributionStatus.filename);
        soosLogger.info(`Writing ${format} report to ${outputFile}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        FileSystem.writeFileSync(outputFile, output as any);
      } else {
        soosLogger.error(
          `${format} report was not generated. Verify a working directory was provided and try again.`,
        );
      }
    } else {
      soosLogger.error(`${format} report generation failed.`);
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
      if (scanStatus.isComplete) {
        return;
      }
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

    if (status === ScanStatus.Incomplete || status === ScanStatus.Error) {
      soosLogger.error(message);
    }
  }

  async findAnalysisFiles(
    scanType: ScanType,
    path: string,
    pattern: string,
    filesToExclude: string[],
    directoriesToExclude: string[],
    maxFiles: number = 0,
  ): Promise<{ filePaths: string[]; hasMoreThanMaximumFiles: boolean }> {
    process.chdir(path);
    soosLogger.info(`Searching for ${scanType} files from ${path}...`);
    const files = Glob.sync(pattern, {
      ignore: [
        ...filesToExclude,
        ...directoriesToExclude,
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

  async findManifestsAndHashableFiles({
    clientId,
    projectHash,
    filesToExclude,
    directoriesToExclude,
    sourceCodePath,
    packageManagers,
    fileMatchType,
  }: {
    clientId: string;
    projectHash: string;
    filesToExclude: string[];
    directoriesToExclude: string[];
    sourceCodePath: string;
    packageManagers: string[];
    fileMatchType: FileMatchTypeEnum;
  }): Promise<{
    manifestFiles: IManifestFile[];
    hashManifests: ISoosHashesManifest[];
  }> {
    const supportedScanFileFormats = await this.analysisApiClient.getSupportedScanFileFormats({
      clientId: clientId,
    });

    const runFileHashing =
      fileMatchType === FileMatchTypeEnum.FileHash ||
      fileMatchType === FileMatchTypeEnum.ManifestAndFileHash;
    const runManifestMatching =
      fileMatchType === FileMatchTypeEnum.Manifest ||
      fileMatchType === FileMatchTypeEnum.ManifestAndFileHash;

    const filteredPackageManagers =
      packageManagers.length === 0
        ? supportedScanFileFormats
        : supportedScanFileFormats.filter((packageManagerScanFileFormats) =>
            packageManagers.some((pm) =>
              StringUtilities.areEqual(pm, packageManagerScanFileFormats.packageManager, {
                sensitivity: "base",
              }),
            ),
          );

    const settings = await this.projectsApiClient.getProjectSettings({
      clientId: clientId,
      projectHash,
    });

    const manifestFormats = !runManifestMatching
      ? []
      : filteredPackageManagers.flatMap((fpm) => {
          return {
            packageManager: fpm.packageManager,
            manifests: fpm.manifests.map((sm) => {
              return {
                isLockFile: sm.isLockFile,
                includeWithLockFiles: sm.includeWithLockFiles,
                supportsLockFiles: sm.SupportsLockFiles,
                pattern: sm.pattern,
              };
            }),
          };
        });

    if (runManifestMatching) {
      soosLogger.debug(
        `Running manifest file matching for ${manifestFormats.length} manifest formats.`,
      );
    }

    const manifestFiles = !runManifestMatching
      ? []
      : this.searchForManifestFiles({
          packageManagerManifests: manifestFormats,
          useLockFile: settings.useLockFile ?? false,
          filesToExclude,
          directoriesToExclude,
          sourceCodePath,
        });

    const archiveHashFormats = !runFileHashing
      ? []
      : filteredPackageManagers.flatMap((fpm) => {
          return {
            packageManager: fpm.packageManager,
            fileFormats: (fpm.hashableFiles ?? []).map((hf) => {
              return {
                hashAlgorithms: hf.hashAlgorithms,
                patterns: hf.archiveFileExtensions ?? [],
              };
            }),
          };
        });

    if (runFileHashing) {
      soosLogger.debug(
        `Running file hash matching for ${archiveHashFormats.length} archive file formats.`,
      );
    }

    const archiveFileHashManifests = !runFileHashing
      ? []
      : this.searchForHashableFiles({
          hashableFileFormats: archiveHashFormats,
          sourceCodePath,
          filesToExclude,
          directoriesToExclude,
        });

    const contentHashFormats = !runFileHashing
      ? []
      : filteredPackageManagers.flatMap((fpm) => {
          return {
            packageManager: fpm.packageManager,
            fileFormats: (fpm.hashableFiles ?? []).map((hf) => {
              return {
                hashAlgorithms: hf.hashAlgorithms,
                patterns: hf.archiveContentFileExtensions ?? [],
              };
            }),
          };
        });

    if (runFileHashing) {
      soosLogger.debug(`Running file hash matching for ${contentHashFormats.length} file formats.`);
    }

    const contentFileHashManifests = !runFileHashing
      ? []
      : this.searchForHashableFiles({
          hashableFileFormats: contentHashFormats,
          sourceCodePath,
          filesToExclude,
          directoriesToExclude,
        });

    // TODO: PA-14211 we could probably just add this to the form files directly
    const hashManifests = archiveFileHashManifests
      .concat(contentFileHashManifests)
      .filter((hm) => hm.fileHashes.length > 0);

    if (runFileHashing && hashManifests.length > 0) {
      for (const soosHashesManifest of hashManifests) {
        if (soosHashesManifest.fileHashes.length > 0) {
          const hashManifestFileName = `${soosHashesManifest.packageManager}${SOOS_CONSTANTS.SCA.SoosFileHashesManifest}`;
          const hashManifestPath = Path.join(sourceCodePath, hashManifestFileName);

          soosLogger.info(`Generating SOOS hashes manifest: ${hashManifestPath}`);
          FileSystem.writeFileSync(hashManifestPath, JSON.stringify(soosHashesManifest, null, 2));

          manifestFiles.push({
            packageManager: soosHashesManifest.packageManager,
            name: hashManifestFileName,
            path: hashManifestPath,
          });
        }
      }
    }

    return { manifestFiles, hashManifests };
  }

  private searchForManifestFiles({
    packageManagerManifests,
    useLockFile,
    filesToExclude,
    directoriesToExclude,
    sourceCodePath,
  }: {
    packageManagerManifests: Array<{
      packageManager: PackageManagerType;
      manifests: Array<{
        pattern: string;
        isLockFile: boolean;
        includeWithLockFiles: boolean;
        supportsLockFiles: boolean;
      }>;
    }>;
    useLockFile: boolean;
    filesToExclude: string[];
    directoriesToExclude: string[];
    sourceCodePath: string;
  }): Array<IManifestFile> {
    const currentDirectory = process.cwd();
    soosLogger.info(`Setting current directory to project path '${sourceCodePath}'.`);
    process.chdir(sourceCodePath);
    soosLogger.info(
      `Lock file setting is ${
        useLockFile ? "on, ignoring non-lock files" : "off, ignoring lock files"
      }.`,
    );
    const manifestFiles = packageManagerManifests.reduce<Array<IManifestFile>>(
      (accumulator, packageManagerManifests) => {
        const matches = packageManagerManifests.manifests
          .filter(
            (manifest) =>
              useLockFile === manifest.isLockFile ||
              (useLockFile && !manifest.isLockFile && !manifest.supportsLockFiles) ||
              (useLockFile && !manifest.isLockFile && manifest.includeWithLockFiles),
          )
          .map((manifest) => {
            const manifestGlobPattern = manifest.pattern.startsWith(".")
              ? `*${manifest.pattern}` // ends with
              : manifest.pattern; // wildcard match

            const pattern = `**/${manifestGlobPattern}`;
            const files = Glob.sync(pattern, {
              ignore: [
                ...filesToExclude,
                ...directoriesToExclude,
                SOOS_CONSTANTS.SCA.SoosPackageDirToExclude,
              ],
              nocase: true,
            });

            // This is needed to resolve the path as an absolute opposed to trying to open the file at current directory.
            const absolutePathFiles = files.map((x) => Path.resolve(x));

            const matchingFilesMessage = `${absolutePathFiles.length} files found matching pattern '${pattern}'.`;
            if (absolutePathFiles.length > 0) {
              soosLogger.info(matchingFilesMessage);
            } else {
              soosLogger.debug(matchingFilesMessage);
            }

            return absolutePathFiles;
          });

        return accumulator.concat(
          matches.flat().map((filePath): IManifestFile => {
            const filename = Path.basename(filePath);
            const fileStats = FileSystem.statSync(filePath);
            const fileSize = formatBytes(fileStats.size);
            soosLogger.info(
              `Found manifest file '${filename}' (${fileSize}) at location '${filePath}'.`,
            );
            return {
              packageManager: packageManagerManifests.packageManager,
              name: filename,
              path: filePath,
            };
          }),
        );
      },
      [],
    );

    process.chdir(currentDirectory);
    soosLogger.info(`Setting current directory back to '${currentDirectory}'.\n`);
    soosLogger.info(`${manifestFiles.length} manifest files found.`);

    return manifestFiles;
  }

  private searchForHashableFiles({
    hashableFileFormats,
    sourceCodePath,
    filesToExclude,
    directoriesToExclude,
  }: {
    hashableFileFormats: Array<{
      packageManager: PackageManagerType;
      fileFormats: Array<{
        patterns: Array<string>;
        hashAlgorithms: Array<{
          hashAlgorithm: HashAlgorithmEnum;
          bufferEncoding: HashEncodingEnum;
          digestEncoding: HashEncodingEnum;
        }>;
      }>;
    }>;
    sourceCodePath: string;
    filesToExclude: string[];
    directoriesToExclude: string[];
  }): Array<ISoosHashesManifest> {
    const currentDirectory = process.cwd();
    soosLogger.info(`Setting current directory to project path '${sourceCodePath}'.`);

    process.chdir(sourceCodePath);
    const fileHashes = hashableFileFormats.reduce<Array<ISoosHashesManifest>>(
      (accumulator, fileFormatToHash) => {
        const matches = fileFormatToHash.fileFormats.flatMap((fileFormat) => {
          return fileFormat.patterns.flatMap((matchPattern) => {
            const manifestGlobPattern = matchPattern.startsWith(".")
              ? `*${matchPattern}` // ends with
              : matchPattern; // wildcard match

            const pattern = `**/${manifestGlobPattern}`;
            const files = Glob.sync(pattern, {
              ignore: [
                ...filesToExclude,
                ...directoriesToExclude,
                SOOS_CONSTANTS.SCA.SoosPackageDirToExclude,
              ],
              nocase: true,
            });

            // This is needed to resolve the path as an absolute opposed to trying to open the file at current directory.
            const absolutePathFiles = files.map((x) => Path.resolve(x));
            const matchingFilesMessage = `${absolutePathFiles.length} files found matching pattern '${matchPattern}'.`;
            if (absolutePathFiles.length > 0) {
              soosLogger.info(matchingFilesMessage);
            } else {
              soosLogger.debug(matchingFilesMessage);
            }

            return absolutePathFiles.flat().map((filePath): ISoosFileHash => {
              const filename = Path.basename(filePath);

              const fileDigests = fileFormat.hashAlgorithms.map((ha) => {
                const digest = generateFileHash(
                  ha.hashAlgorithm,
                  ha.bufferEncoding,
                  ha.digestEncoding,
                  filePath,
                );

                soosLogger.debug(`Found '${filePath}' (${ha.hashAlgorithm}:${digest})`);

                return {
                  digest: digest,
                  hashAlgorithm: ha.hashAlgorithm,
                };
              });

              return {
                digests: fileDigests.map((d) => {
                  return {
                    hashAlgorithm: d.hashAlgorithm,
                    digest: d.digest,
                  };
                }),
                filename: filename,
                path: filePath,
              };
            });
          });
        });

        return accumulator.concat({
          packageManager: fileFormatToHash.packageManager,
          fileHashes: matches,
        });
      },
      [],
    );

    process.chdir(currentDirectory);
    soosLogger.info(`Setting current directory back to '${currentDirectory}'.\n`);

    return fileHashes;
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

    const formData = new FormData();

    for (let index = 0; index < analysisFiles.length; index++) {
      const analysisFile = analysisFiles[index];
      if (!analysisFile) {
        continue;
      }

      const fileParts = analysisFile.path.replace(workingDirectory, "").split(Path.sep);
      const parentFolder =
        fileParts.length >= 2 ? fileParts.slice(0, fileParts.length - 1).join(Path.sep) : "";
      const suffix = index > 0 ? index : "";

      const base64Content = await FileUtilities.readFileToBase64Async(analysisFile.path);
      formData.append(`file${suffix}`, base64Content, analysisFile.name);

      formData.append(`parentFolder${suffix}`, parentFolder);
    }

    return formData;
  }

  async addManifestsAndHashableFilesToScan({
    clientId,
    projectHash,
    branchHash,
    analysisId,
    scanType,
    scanStatusUrl,
    fileMatchType,
    manifestFiles,
    hashManifests,
  }: {
    clientId: string;
    projectHash: string;
    branchHash: string;
    analysisId: string;
    scanType: ScanType;
    scanStatusUrl: string;
    fileMatchType: FileMatchTypeEnum;
    manifestFiles: IManifestFile[];
    hashManifests: ISoosHashesManifest[];
  }): Promise<{ exitCode: number; errorMessage?: string }> {
    let noFilesMessage = null;
    if (fileMatchType === FileMatchTypeEnum.Manifest && manifestFiles.length === 0) {
      noFilesMessage =
        "No valid files found, cannot continue. For more help, please visit https://kb.soos.io/error-no-valid-manifests-found";
    } else if (fileMatchType === FileMatchTypeEnum.FileHash && hashManifests.length === 0) {
      noFilesMessage =
        "No valid files to hash were found, cannot continue. For more help, please visit https://kb.soos.io/error-no-valid-files-to-hash-found";
    } else if (
      fileMatchType === FileMatchTypeEnum.ManifestAndFileHash &&
      hashManifests.length === 0 &&
      manifestFiles.length === 0
    ) {
      noFilesMessage =
        "No valid files found, cannot continue. For more help, please visit https://kb.soos.io/error-no-valid-manifests-found and https://kb.soos.io/error-no-valid-files-to-hash-found";
    }
    if (noFilesMessage) {
      await this.updateScanStatus({
        analysisId,
        clientId,
        projectHash,
        branchHash,
        scanType,
        status: ScanStatus.NoFiles,
        message: noFilesMessage,
        scanStatusUrl,
      });
      soosLogger.error(noFilesMessage);
      soosLogger.always(`${noFilesMessage} - exit 1`);
      return { exitCode: 1, errorMessage: noFilesMessage };
    }

    const filesToUpload = manifestFiles.slice(0, SOOS_CONSTANTS.FileUploads.MaxManifests);
    const hasMoreThanMaximumManifests =
      manifestFiles.length > SOOS_CONSTANTS.FileUploads.MaxManifests;
    if (hasMoreThanMaximumManifests) {
      const filesToSkip = manifestFiles.slice(SOOS_CONSTANTS.FileUploads.MaxManifests);
      const filesDetectedString = StringUtilities.pluralizeTemplate(
        manifestFiles.length,
        "file was",
        "files were",
      );
      const filesSkippedString = StringUtilities.pluralizeTemplate(filesToSkip.length, "file");
      soosLogger.info(
        `The maximum number of manifest per scan is ${SOOS_CONSTANTS.FileUploads.MaxManifests}. ${filesDetectedString} detected, and ${filesSkippedString} will be not be uploaded. \n`,
        `The following manifests will not be included in the scan: \n`,
        filesToSkip.map((file) => `  "${file.name}": "${file.path}"`).join("\n"),
      );
    }

    const manifestsByPackageManager = filesToUpload.reduce<Record<string, Array<IManifestFile>>>(
      (accumulator, file) => {
        const packageManagerFiles =
          (accumulator[file.packageManager] as Array<IManifestFile> | undefined) ?? [];
        return {
          ...accumulator,
          [file.packageManager]: packageManagerFiles.concat(file),
        };
      },
      {},
    );

    let allUploadsFailed = true;
    const errorMessages = [];
    for (const [packageManager, files] of Object.entries(manifestsByPackageManager)) {
      try {
        // TODO: PA-14211 can we add the soos_hashes.json directly
        const manifestUploadResponse = await this.uploadManifestFiles({
          clientId,
          projectHash,
          branchHash,
          analysisId,
          manifestFiles: files.map((f) => f.path),
          hasMoreThanMaximumManifests,
        });

        soosLogger.info(
          `${packageManager} Manifest Files: \n`,
          `  ${manifestUploadResponse.message} \n`,
          manifestUploadResponse.manifests
            ?.map((m) => `  ${m.name}: ${m.statusMessage}`)
            .join("\n"),
        );

        allUploadsFailed = false;
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : (e as string);
        errorMessages.push(errorMessage);
        soosLogger.warn(errorMessage);
      }
    }
    if (allUploadsFailed) {
      await this.updateScanStatus({
        analysisId,
        clientId,
        projectHash,
        branchHash,
        scanType,
        status: ScanStatus.NoFiles,
        message: `All manifest uploads were unsuccessful. (${errorMessages.join("; ")})`,
        scanStatusUrl,
      });
      noFilesMessage =
        "All manifest uploads were unsuccessful. For more help, please visit https://kb.soos.io/error-no-valid-manifests-found";
      soosLogger.error(noFilesMessage);
      soosLogger.always(`${noFilesMessage} - exit 1`);
      return { exitCode: 1, errorMessage: noFilesMessage };
    }

    return { exitCode: 0 };
  }

  private async uploadManifestFiles({
    clientId,
    projectHash,
    branchHash,
    analysisId,
    manifestFiles,
    hasMoreThanMaximumManifests,
  }: {
    clientId: string;
    projectHash: string;
    branchHash: string;
    analysisId: string;
    manifestFiles: Array<string>;
    hasMoreThanMaximumManifests: boolean;
  }): Promise<IUploadManifestFilesResponse> {
    const formData = await this.getAnalysisFilesAsFormData(manifestFiles, process.cwd());

    const response = await this.analysisApiClient.uploadManifestFiles({
      clientId,
      projectHash,
      branchHash,
      analysisId,
      manifestFiles: formData,
      hasMoreThanMaximumManifests,
    });

    return response;
  }
}

export { GeneratedScanTypes, IManifestFile };
export default AnalysisService;
