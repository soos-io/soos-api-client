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
  ScanStatus,
} from "./api-types";
import { constructBaseApiUrl, isNil } from "./utils/Utilities";
import { SOOS_ANALYSIS_API } from "./utils/Constants";
import createHttpClient, { isAxiosError } from "./api-client";
import FormData from "form-data";

export enum EnvironmentEnum {
  Dev = "dev-",
  QA = "qa-",
  Prod = "",
}

export class SOOSApiClient {
  private readonly environment: EnvironmentEnum;
  private readonly apiKey: string;
  private readonly clientId: string;

  constructor(environment: EnvironmentEnum, apiKey: string, clientId: string) {
    this.environment = environment;
    this.apiKey = apiKey;
    this.clientId = clientId;
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
    const client = createHttpClient({
      baseUri: constructBaseApiUrl(this.environment, SOOS_ANALYSIS_API),
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
    const client = createHttpClient({
      baseUri: constructBaseApiUrl(this.environment, SOOS_ANALYSIS_API),
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
    const client = createHttpClient({
      baseUri: constructBaseApiUrl(this.environment, SOOS_ANALYSIS_API),
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
    const client = createHttpClient({
      baseUri: constructBaseApiUrl(this.environment, SOOS_ANALYSIS_API),
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
    const client = createHttpClient({
      baseUri: constructBaseApiUrl(this.environment, SOOS_ANALYSIS_API),
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

export default SOOSApiClient;
