import { SOOS_BASE_URL } from "../constants";
import { isAxiosError, SOOSApiClient } from "./SOOSApiClient";
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
  IUploadResponseError,
} from "../models/Analysis";
import { ScanStatus } from "../enums";

export class SOOSAnalysisApiClient {
  private readonly baseUri: string;
  private readonly apiKey: string;
  private readonly clientId: string;

  constructor(apiKey: string, clientId: string, baseUri: string = SOOS_BASE_URL) {
    this.apiKey = apiKey;
    this.clientId = clientId;
    this.baseUri = baseUri;
  }

  async createScan({
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
    const client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      clientName: "Create Scan",
    });
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

    const response = await client.post<IApiCreateScanResponseBody>(
      `clients/${this.clientId}/scan-types/${scanType}/scans`,
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
    const client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      clientName: "Upload  Container Files",
      errorResponseHandler: (rejectedResponse) => {
        if (isAxiosError<IUploadResponseError | undefined>(rejectedResponse)) {
          if (rejectedResponse.response?.data?.code === "NoManifestsAccepted") {
            throw new Error(rejectedResponse.response.data.message);
          }
        }
      },
    });

    const headers: FormData.Headers = await new Promise((resolve) =>
      manifestFiles.getLength((error, length) =>
        isNil(error) && !isNil(length)
          ? resolve(manifestFiles.getHeaders({ "Content-Length": length.toString() }))
          : resolve(manifestFiles.getHeaders())
      )
    );

    const response = await client.post<IUploadManifestResponse>(
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
    const client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      clientName: "Start Analysis Scan",
    });
    await client.put(`clients/${clientId}/projects/${projectHash}/analysis/${analysisId}`);
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
    const client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      clientName: "Update Scan Status",
    });
    await client.patch(
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
    const client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      clientName: "Check Analysis Scan Status",
    });
    const response = await client.get<ICheckAnalysisScanStatusReturn>(reportStatusUrl);
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
