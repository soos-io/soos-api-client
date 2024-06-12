import { FileMatchTypeEnum, HashAlgorithmEnum, HashEncodingEnum } from "./../enums";
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
  OutputFormat,
  PackageManagerType,
  ScanStatus,
  ScanType,
  SeverityEnum,
} from "../enums";
import { soosLogger } from "../logging";
import { StringUtilities, formatBytes, generateFileHash, isNil, sleep } from "../utilities";
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
  [IntegrationName.VisualStudio]: "SOOS_CONTRIBUTING_DEVELOPER",
  [IntegrationName.VisualStudioCode]: "SOOS_CONTRIBUTING_DEVELOPER",
};

const GeneratedScanTypes = [ScanType.CSA, ScanType.SBOM, ScanType.SCA];

const NoneColor = "\x1b[32m";
const InfoColor = "\x1b[34m";
const LowColor = "\x1b[90m";
const MediumColor = "\x1b[33m";
const HighColor = "\x1b[31m";
const CriticalColor = "\x1b[31m";
const ResetColor = "\x1b[0m";

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

    if (contributingDeveloperAudit?.length === 0) {
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
    isFirstCheckComplete = false,
  }: IWaitForScanToFinishParams): Promise<ScanStatus> {
    const scanStatus = await this.analysisApiClient.getScanStatus({
      scanStatusUrl: scanStatusUrl,
    });

    if (!scanStatus.isComplete) {
      soosLogger.info(`${StringUtilities.fromCamelToTitleCase(scanStatus.status)}...`);
      await sleep(SOOS_CONSTANTS.Status.DelayTime);
      return await this.waitForScanToFinish({ scanStatusUrl, scanUrl, scanType });
    }

    // TODO - ensure stats via PA-12747
    if (!isFirstCheckComplete) {
      await sleep(SOOS_CONSTANTS.Status.DelayTime);
      return await this.waitForScanToFinish({
        scanStatusUrl,
        scanUrl,
        scanType,
        isFirstCheckComplete: true,
      });
    }

    if (scanStatus.errors.length > 0) {
      soosLogger.group("Errors:");
      soosLogger.warn(JSON.stringify(scanStatus.errors, null, 2));
      soosLogger.groupEnd();
    }

    const output = this.getFinalScanStatusMessage(scanType, scanStatus, scanUrl, true);

    soosLogger.logLineSeparator();
    output.map((o) => soosLogger.always(o));
    soosLogger.logLineSeparator();

    return scanStatus.status;
  }

  private getColorBySeverity(severity: string | undefined, colorize: boolean): string {
    if (!severity) {
      return "";
    }

    switch (severity.toLocaleLowerCase()) {
      default:
      case "unknown":
        return "";
      case "none":
        return colorize ? NoneColor : "";
      case "info":
        return colorize ? InfoColor : "";
      case "low":
        return colorize ? LowColor : "";
      case "medium":
        return colorize ? MediumColor : "";
      case "high":
        return colorize ? HighColor : "";
      case "critical":
        return colorize ? CriticalColor : "";
    }
  }

  private getResetColor(colorize: boolean): string {
    return colorize ? ResetColor : "";
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
      `Scan ${scanStatus.isSuccess ? `${this.getColorBySeverity("none", colorize)}passed${this.getResetColor(colorize)}` : `${this.getColorBySeverity("high", colorize)}failed${this.getResetColor(colorize)}`}${
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
        )}${this.getColorBySeverity(scanStatus.issues?.Vulnerability?.maxSeverity, colorize)}${vulnerabilityCount}${this.getResetColor(colorize)}`,
      );
    }

    const violationCount = scanStatus.issues?.Violation?.count ?? 0;
    output.push(
      `${StringUtilities.pluralizeWord(violationCount, "Violation:", "Violations:").padEnd(
        maxLengthOfIssueText,
        padChar,
      )}${this.getColorBySeverity(scanStatus.issues?.Violation?.maxSeverity, colorize)}${violationCount}${this.getResetColor(colorize)}`,
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
        )}${this.getColorBySeverity(scanStatus.issues?.Dast?.maxSeverity, colorize)}${dastCount}${this.getResetColor(colorize)}`,
      );
    }

    if (scanType === ScanType.SAST) {
      const sastCount = scanStatus.issues?.Sast?.count ?? 0;
      output.push(
        `${StringUtilities.pluralizeWord(sastCount, "Code Issue:", "Code Issues:").padEnd(
          maxLengthOfIssueText,
          padChar,
        )}${this.getColorBySeverity(scanStatus.issues?.Sast?.maxSeverity, colorize)}${sastCount}${this.getResetColor(colorize)}`,
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
        )}${this.getColorBySeverity(scanStatus.issues?.UnknownPackage?.maxSeverity, colorize)}${unknownPackageCount}${this.getResetColor(colorize)}`,
      );

      const dependencyTypoCount = scanStatus.issues?.DependencyTypo?.count ?? 0;
      output.push(
        `${StringUtilities.pluralizeWord(
          dependencyTypoCount,
          "Dependency Typo:",
          "Dependency Typos:",
        ).padEnd(
          maxLengthOfIssueText,
          padChar,
        )}${this.getColorBySeverity(scanStatus.issues?.DependencyTypo?.maxSeverity, colorize)}${dependencyTypoCount}${this.getResetColor(colorize)}`,
      );

      const dependencySubstitutionCount = scanStatus.issues?.DependencySubstitution?.count ?? 0;
      output.push(
        `${StringUtilities.pluralizeWord(
          dependencySubstitutionCount,
          "Dependency Substitution:",
          "Dependency Substitutions:",
        ).padEnd(
          maxLengthOfIssueText,
          padChar,
        )}${this.getColorBySeverity(scanStatus.issues?.DependencySubstitution?.maxSeverity, colorize)}${dependencySubstitutionCount}${this.getResetColor(colorize)}`,
      );
    }

    output.push(`Scan Report: ${scanUrl}`);

    return output;
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
    manifestFiles: IManifestFile[] | null;
    hashManifests: ISoosHashesManifest[] | null;
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
      isNil(packageManagers) || packageManagers.length === 0
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

    var manifestFormats = !runManifestMatching
      ? []
      : filteredPackageManagers.flatMap((fpm) => {
          return {
            packageManager: fpm.packageManager,
            manifests:
              fpm.supportedManifests?.map((sm) => {
                return {
                  isLockFile: sm.isLockFile,
                  pattern: sm.pattern,
                };
              }) ?? [],
          };
        });

    const manifestFiles = !runManifestMatching
      ? []
      : this.searchForManifestFiles({
          packageManagerManifests: manifestFormats,
          useLockFile: settings.useLockFile ?? false,
          filesToExclude,
          directoriesToExclude,
          sourceCodePath,
        }) ?? [];

    var archiveHashFormats = !runFileHashing
      ? []
      : filteredPackageManagers.flatMap((fpm) => {
          return !fpm.hashableFiles?.some((hf) => hf.archiveFileExtensions)
            ? []
            : {
                packageManager: fpm.packageManager,
                fileFormats:
                  fpm.hashableFiles?.map((hf) => {
                    return {
                      hashAlgorithms: hf.hashAlgorithms,
                      patterns: hf.archiveFileExtensions?.filter((afe) => !isNil(afe)) ?? [],
                    };
                  }) ?? [],
              };
        });

    const archiveFileHashManifests =
      !runFileHashing || !archiveHashFormats.some((ahf) => ahf.fileFormats)
        ? null
        : this.searchForHashableFiles({
            hashableFileFormats: archiveHashFormats.filter((ahf) => ahf.fileFormats),
            sourceCodePath,
            filesToExclude,
            directoriesToExclude,
          });

    var contentHashFormats = !runFileHashing
      ? []
      : filteredPackageManagers.flatMap((fpm) => {
          return !fpm.hashableFiles?.some((hf) => hf.archiveContentFileExtensions)
            ? []
            : {
                packageManager: fpm.packageManager,
                fileFormats:
                  fpm.hashableFiles?.map((hf) => {
                    return {
                      hashAlgorithms: hf.hashAlgorithms,
                      patterns: hf.archiveContentFileExtensions?.filter((afe) => !isNil(afe)) ?? [],
                    };
                  }) ?? [],
              };
        });

    const contentFileHashManifests =
      !runFileHashing || !contentHashFormats.some((chf) => chf.fileFormats)
        ? null
        : this.searchForHashableFiles({
            hashableFileFormats: contentHashFormats.filter((chf) => chf.fileFormats),
            sourceCodePath,
            filesToExclude,
            directoriesToExclude,
          });

    // TODO: PA-14211 we could probably just add this to the form files directly
    const hashManifests = (archiveFileHashManifests ?? [])
      .concat(contentFileHashManifests ?? [])
      .filter((hm) => hm.fileHashes.length > 0);

    if (runFileHashing && hashManifests) {
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
      }>;
    }>;
    useLockFile: boolean;
    filesToExclude: string[];
    directoriesToExclude: string[];
    sourceCodePath: string;
  }): Array<IManifestFile> {
    const currentDirectory = process.cwd();
    soosLogger.info(`Setting current working directory to project path '${sourceCodePath}'.`);
    process.chdir(sourceCodePath);
    soosLogger.info(
      `Lock file setting is ${
        useLockFile ? "on, ignoring non-lock files" : "off, ignoring lock files"
      }.`,
    );
    const manifestFiles = packageManagerManifests.reduce<Array<IManifestFile>>(
      (accumulator, packageManagerManifests) => {
        const matches = packageManagerManifests.manifests
          .filter((manifest) => useLockFile === manifest.isLockFile)
          .map((manifest) => {
            const manifestGlobPattern = manifest.pattern.startsWith(".")
              ? `*${manifest.pattern}` // ends with
              : manifest.pattern; // wildcard match

            const pattern = `**/${manifestGlobPattern}`;
            const files = Glob.sync(pattern, {
              ignore: [
                ...(filesToExclude || []),
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
              soosLogger.verboseInfo(matchingFilesMessage);
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
    soosLogger.info(`Setting current working directory back to '${currentDirectory}'.\n`);
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
    soosLogger.info(`Setting current working directory to project path '${sourceCodePath}'.`);

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
                ...(filesToExclude || []),
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
              soosLogger.verboseInfo(matchingFilesMessage);
            }

            return absolutePathFiles.flat().map((filePath): ISoosFileHash => {
              const filename = Path.basename(filePath);

              var fileDigests = fileFormat.hashAlgorithms.map((ha) => {
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
    soosLogger.info(`Setting current working directory back to '${currentDirectory}'.\n`);

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

  async addManifestFilesToScan({
    clientId,
    projectHash,
    branchHash,
    analysisId,
    scanType,
    scanStatusUrl,
    manifestFiles,
  }: {
    clientId: string;
    projectHash: string;
    branchHash: string;
    analysisId: string;
    scanType: ScanType;
    scanStatusUrl: string;
    manifestFiles: Array<IManifestFile>;
  }): Promise<void> {
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
    for (const [packageManager, files] of Object.entries(manifestsByPackageManager)) {
      try {
        const manifestUploadResponse = await this.uploadManifestFiles({
          clientId: clientId,
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
        // NOTE: we continue on to the other package managers
        soosLogger.warn(e instanceof Error ? e.message : (e as string));
      }
    }

    if (allUploadsFailed) {
      await this.updateScanStatus({
        clientId,
        projectHash,
        branchHash,
        scanType,
        analysisId: analysisId,
        status: ScanStatus.Incomplete,
        message: `Error uploading manifests.`,
        scanStatusUrl,
      });
      throw new Error("Error uploading manifests.");
    }
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
