import SOOSAnalysisApiClient, {
  ICreateScanRequestContributingDeveloperAudit,
  ICreateScanResponse,
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
import { StringUtilities, formatBytes, isNil, sleep } from "../utilities";
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
  packageManager: PackageManagerType;
  name: string;
  path: string;
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

    const isGeneratedScanType = GeneratedScanTypes.includes(scanType);

    const vulnerabilities = isGeneratedScanType
      ? `(${StringUtilities.pluralizeTemplate(
          scanStatus.issues?.Vulnerability?.count ?? 0,
          "vulnerability",
          "vulnerabilities",
        )}) `
      : "";

    const codeIssues =
      scanType === ScanType.SAST
        ? `(${StringUtilities.pluralizeTemplate(
            scanStatus.issues?.Sast?.count ?? 0,
            "code issue",
          )}) `
        : "";

    const webVulnerabilities =
      scanType === ScanType.DAST
        ? `(${StringUtilities.pluralizeTemplate(
            scanStatus.issues?.Dast?.count ?? 0,
            "web vulnerability",
            "web vulnerabilities",
          )}) `
        : "";

    const violations = isGeneratedScanType
      ? `(${StringUtilities.pluralizeTemplate(
          scanStatus.issues?.Violation?.count ?? 0,
          "violation",
        )}) `
      : "";

    const substitutions = isGeneratedScanType
      ? `(${StringUtilities.pluralizeTemplate(
          scanStatus.issues?.DependencySubstitution?.count ?? 0,
          "dependency substitution",
        )}) `
      : "";

    const typos = isGeneratedScanType
      ? `(${StringUtilities.pluralizeTemplate(
          scanStatus.issues?.DependencyTypo?.count ?? 0,
          "dependency typo",
        )}) `
      : "";

    const unknownPackages = isGeneratedScanType
      ? `(${StringUtilities.pluralizeTemplate(
          scanStatus.issues?.UnknownPackage?.count ?? 0,
          "unknown package",
        )}) `
      : "";

    soosLogger.always(
      `Scan ${scanStatus.isSuccess ? "passed" : "failed"}${
        scanStatus.isSuccess ? ", with" : " because of"
      } ${vulnerabilities}${codeIssues}${webVulnerabilities}${violations}${substitutions}${typos}${unknownPackages}`,
    );
    soosLogger.info(`View the results here: ${scanUrl}`);
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

  async findManifestFiles({
    clientId,
    projectHash,
    branchHash,
    scanType,
    analysisId,
    scanStatusUrl,
    filesToExclude,
    directoriesToExclude,
    sourceCodePath,
    packageManagers,
  }: {
    clientId: string;
    projectHash: string;
    branchHash: string;
    scanType: ScanType;
    analysisId: string;
    scanStatusUrl: string;
    filesToExclude: string[];
    directoriesToExclude: string[];
    sourceCodePath: string;
    packageManagers: string[];
  }): Promise<IManifestFile[]> {
    const supportedManifestsResponse = await this.analysisApiClient.getSupportedManifests({
      clientId: clientId,
    });

    const filteredPackageManagers =
      isNil(packageManagers) || packageManagers.length === 0
        ? supportedManifestsResponse
        : supportedManifestsResponse.filter((packageManagerManifests) =>
            packageManagers.some((pm) =>
              StringUtilities.areEqual(pm, packageManagerManifests.packageManager, {
                sensitivity: "base",
              }),
            ),
          );

    const settings = await this.projectsApiClient.getProjectSettings({
      clientId: clientId,
      projectHash,
    });

    const manifestFiles = this.searchForManifestFiles({
      clientId,
      projectHash,
      branchHash,
      scanType,
      analysisId,
      scanStatusUrl,
      packageManagerManifests: filteredPackageManagers,
      useLockFile: settings.useLockFile ?? false,
      filesToExclude,
      directoriesToExclude,
      sourceCodePath,
    });

    return manifestFiles;
  }

  private async searchForManifestFiles({
    clientId,
    projectHash,
    branchHash,
    scanType,
    analysisId,
    scanStatusUrl,
    packageManagerManifests,
    useLockFile,
    filesToExclude,
    directoriesToExclude,
    sourceCodePath,
  }: {
    clientId: string;
    projectHash: string;
    branchHash: string;
    scanType: ScanType;
    analysisId: string;
    scanStatusUrl: string;
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
  }): Promise<Array<IManifestFile>> {
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

    if (manifestFiles.length === 0) {
      const errorMessage =
        "No valid manifests found, cannot continue. For more help, please visit https://kb.soos.io/help/error-no-valid-manifests-found";
      await this.updateScanStatus({
        clientId: clientId,
        projectHash,
        branchHash,
        scanType,
        analysisId: analysisId,
        status: ScanStatus.Incomplete,
        message: errorMessage,
        scanStatusUrl,
      });
      throw new Error(errorMessage);
    }

    return manifestFiles;
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

export { GeneratedScanTypes };
export default AnalysisService;
