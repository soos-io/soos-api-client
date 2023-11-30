import StringUtilities from "../StringUtilities";
import SOOSAnalysisApiClient, {
  ICreateScanRequestContributingDeveloperAudit,
  ICreateScanResponse,
} from "../api/SOOSAnalysisApiClient";
import { SOOS_CONSTANTS } from "../constants";
import { OutputFormat, ScanStatus, ScanType } from "../enums";
import { soosLogger } from "../logging";
import { sleep } from "../utilities";
import * as FileSystem from "fs";
import * as Path from "path";

interface IRunOutputFormatParams {
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

class AnalysisService {
  private analysisApiClient: SOOSAnalysisApiClient;

  constructor(analysisApiClient: SOOSAnalysisApiClient) {
    this.analysisApiClient = analysisApiClient;
  }

  static create(apiKey: string, apiURL: string): AnalysisService {
    const analysisApiClient = new SOOSAnalysisApiClient(apiKey, apiURL);

    return new AnalysisService(analysisApiClient);
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
  }: {
    clientId: string;
    projectName: string;
    branchName: string;
    commitHash: string;
    buildVersion: string;
    buildUri: string;
    branchUri: string;
    integrationType: string;
    operatingEnvironment: string;
    integrationName: string;
    appVersion: string;
    scriptVersion: string;
    contributingDeveloperAudit: ICreateScanRequestContributingDeveloperAudit[];
    scanType: ScanType;
  }): Promise<ICreateScanResponse> {
    soosLogger.info(`Starting SOOS ${scanType} Analysis`);
    soosLogger.info(`Creating scan for project '${projectName}'...`);
    soosLogger.info(`Branch Name: ${branchName}`);

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
      toolName: null,
      toolVersion: null,
    });

    soosLogger.info(`Project Hash: ${result.projectHash}`);
    soosLogger.info(`Branch Hash: ${result.branchHash}`);
    soosLogger.info(`Scan Id: ${result.analysisId}`);
    soosLogger.info("Scan created successfully.");

    return result;
  }

  async waitForScanToFinish({
    scanStatusUrl,
    scanUrl,
  }: {
    scanStatusUrl: string;
    scanUrl: string;
  }): Promise<ScanStatus> {
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

      const violations = StringUtilities.pluralizeTemplate(
        scanStatus.violations,
        "violation",
        "violations",
      );

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

  async runOutputFormat({
    clientId,
    projectHash,
    projectName,
    branchHash,
    scanType,
    analysisId,
    outputFormat,
    sourceCodePath,
    workingDirectory,
  }: IRunOutputFormatParams): Promise<void> {
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
}

export default AnalysisService;
