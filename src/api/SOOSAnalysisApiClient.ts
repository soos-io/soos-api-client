import { SOOS_BASE_URL } from "../constants";
import { SOOSApiClient } from "./SOOSApiClient";
import FormData from "form-data";
import { isNil } from "../utils/utilities";
import {
  CompletedScanStatuses,
  IAnalysisScanStatus,
  IApiCreateScanRequestBody,
  IApiCreateScanResponseBody,
  ICheckAnalysisScanStatusArguments,
  ICheckAnalysisScanStatusReturn,
  ICreateScanArguments,
  ICreateScanReturn,
  IStartAnalysisArguments,
  IUpdateScanStatusArguments,
  IUploadManifestFilesArguments,
  IUploadManifestResponse,
} from "../models/Analysis";
import { ScanStatus } from "../enums";
import { AxiosInstance } from "axios";

export class SOOSAnalysisApiClient {
  private readonly baseUri: string;
  private readonly apiKey: string;
  private readonly client: AxiosInstance;

  constructor(apiKey: string, baseUri: string = SOOS_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUri = baseUri;
    this.client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      apiClientName: "Analysis API Client",
    });
  }

  async createScan({
    clientId,
    projectName,
    commitHash,
    branch,
    buildVersion,
    buildUri,
    branchUri,
    integrationType,
    operatingEnvironment,
    integrationName,
    scanType,
  }: ICreateScanArguments): Promise<ICreateScanReturn> {
    const body: IApiCreateScanRequestBody = {
      projectName: projectName,
      commitHash: commitHash,
      branch: branch,
      buildVersion: buildVersion,
      buildUri: buildUri,
      branchUri: branchUri,
      integrationType: integrationType,
      operatingEnvironment: operatingEnvironment,
      integrationName: integrationName,
    };

    const response = await this.client.post<IApiCreateScanResponseBody>(
      `clients/${clientId}/scan-types/${scanType}/scans`,
      body
    );

    return {
      projectHash: response.data.projectHash,
      branchHash: response.data.branchHash,
      scanId: response.data.scanId ?? response.data.analysisId,
      reportUrl: response.data.scanUrl,
      scanStatusUrl: response.data.scanStatusUrl,
    };
  }

  async uploadManifestFiles({
    clientId,
    projectHash,
    analysisId,
    manifestFiles,
  }: IUploadManifestFilesArguments): Promise<IUploadManifestResponse> {
    const headers: FormData.Headers = await new Promise((resolve) =>
      manifestFiles.getLength((error, length) =>
        isNil(error) && !isNil(length)
          ? resolve(manifestFiles.getHeaders({ "Content-Length": length.toString() }))
          : resolve(manifestFiles.getHeaders())
      )
    );

    const response = await this.client.post<IUploadManifestResponse>(
      `clients/${clientId}/projects/${projectHash}/analysis/${analysisId}/manifests`,
      manifestFiles,
      {
        headers: headers,
      }
    );

    return response.data;
  }

  async startAnalysisScan({
    clientId,
    projectHash,
    analysisId,
  }: IStartAnalysisArguments): Promise<void> {
    await this.client.put(`clients/${clientId}/projects/${projectHash}/analysis/${analysisId}`);
  }

  async updateScanStatus({
    clientId,
    projectHash,
    branchHash,
    scanType,
    scanId,
    status,
    message,
  }: IUpdateScanStatusArguments): Promise<void> {
    await this.client.patch(
      `clients/${clientId}/projects/${projectHash}/branches/${branchHash}/scan-types/${scanType}/scans/${scanId}`,
      {
        status: status,
        message: message,
      }
    );
  }

  async checkAnalysisScanStatus({
    reportStatusUrl,
  }: ICheckAnalysisScanStatusArguments): Promise<IAnalysisScanStatus> {
    const response = await this.client.get<ICheckAnalysisScanStatusReturn>(reportStatusUrl);
    const violationCount = response.data.violations?.count ?? 0;
    const vulnerabilityCount = response.data.vulnerabilities?.count ?? 0;
    return {
      status: response.data.status,
      isComplete: CompletedScanStatuses.includes(response.data.status),
      isSuccess: response.data.status === ScanStatus.Finished,
      hasIssues: violationCount > 0 || vulnerabilityCount > 0,
      violations: violationCount,
      vulnerabilities: vulnerabilityCount,
      errors: response.data.errors ?? [],
    };
  }
}

export default SOOSAnalysisApiClient;
