import AnalysisService from "./AnalysisService";
import { soosLogger } from "../logging";
import * as Glob from "glob";
import * as Path from "path";
import * as FileSystem from "fs";
import { StringUtilities, formatBytes, isNil } from "../utilities";
import { SOOS_CONSTANTS } from "../constants";
import { IUploadManifestFilesResponse } from "../api";

interface IManifestFile {
  packageManager: string;
  name: string;
  path: string;
}

class ScaScanService {
  public analysisService: AnalysisService;

  constructor(analysisService: AnalysisService) {
    this.analysisService = analysisService;
  }

  static create(apiKey: string, apiURL: string): ScaScanService {
    const analysisService = AnalysisService.create(apiKey, apiURL);

    return new ScaScanService(analysisService);
  }

  async searchManifestFiles({
    clientId,
    projectHash,
    filesToExclude,
    directoriesToExclude,
    sourceCodePath,
  }: {
    clientId: string;
    projectHash: string;
    filesToExclude: string[];
    directoriesToExclude: string[];
    sourceCodePath: string;
  }): Promise<IManifestFile[]> {
    const supportedManifestsResponse =
      await this.analysisService.analysisApiClient.getSupportedManifests({
        clientId: clientId,
      });

    const filteredPackageManagers =
      isNil(null) || [].length === 0
        ? supportedManifestsResponse
        : supportedManifestsResponse.filter((packageManagerManifests) =>
            [].some((pm) =>
              StringUtilities.areEqual(pm, packageManagerManifests.packageManager, {
                sensitivity: "base",
              }),
            ),
          );

    const settings = await this.analysisService.projectsApiClient.getProjectSettings({
      clientId: clientId,
      projectHash,
    });

    const manifestFiles = this.searchForManifestFiles({
      packageManagerManifests: filteredPackageManagers,
      useLockFile: settings.useLockFile ?? false,
      filesToExclude,
      directoriesToExclude,
      sourceCodePath,
    });

    return manifestFiles;
  }

  private searchForManifestFiles({
    packageManagerManifests,
    useLockFile,
    filesToExclude,
    directoriesToExclude,
    sourceCodePath,
  }: {
    packageManagerManifests: Array<{
      packageManager: string;
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

  async addManifestFilesToScan({
    analysisService,
    clientId,
    projectHash,
    branchHash,
    analysisId,
    manifestFiles,
  }: {
    analysisService: AnalysisService;
    clientId: string;
    projectHash: string;
    branchHash: string;
    analysisId: string;
    manifestFiles: Array<IManifestFile>;
    hasMoreThanMaximumManifests: boolean;
  }): Promise<boolean> {
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
          analysisService,
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

    return allUploadsFailed;
  }

  private async uploadManifestFiles({
    analysisService,
    clientId,
    projectHash,
    branchHash,
    analysisId,
    manifestFiles,
    hasMoreThanMaximumManifests,
  }: {
    analysisService: AnalysisService;
    clientId: string;
    projectHash: string;
    branchHash: string;
    analysisId: string;
    manifestFiles: Array<string>;
    hasMoreThanMaximumManifests: boolean;
  }): Promise<IUploadManifestFilesResponse> {
    const formData = await analysisService.getAnalysisFilesAsFormData(manifestFiles, process.cwd());

    const response = await analysisService.analysisApiClient.uploadManifestFiles({
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

export default ScaScanService;
