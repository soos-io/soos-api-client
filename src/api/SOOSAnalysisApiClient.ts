import { SOOS_CONSTANTS } from "../constants";
import FormData from "form-data";
import {
  IntegrationName,
  ManifestStatus,
  OutputFormat,
  PackageManagerType,
  ScanStatus,
  ScanType,
} from "../enums";
import { AxiosInstance } from "axios";
import { ICodedMessageModel } from "../models";
import SOOSApiClient from "./SOOSApiClient";

const CompletedScanStatuses = [
  ScanStatus.Error,
  ScanStatus.Incomplete,
  ScanStatus.FailedWithIssues,
  ScanStatus.Finished,
];

interface ICreateScanRequestContributingDeveloperAudit {
  source: string | null;
  sourceName: string | null;
  contributingDeveloperId: string | null;
}

interface ICreateScanRequest {
  clientId: string;
  projectName: string;
  commitHash: string | null;
  branch: string | null;
  scanType: ScanType;
  buildVersion: string | null;
  buildUri: string | null;
  branchUri: string | null;
  integrationType: string;
  operatingEnvironment: string;
  integrationName: IntegrationName;
  scriptVersion: string | null;
  appVersion: string | null;
  contributingDeveloperAudit?: ICreateScanRequestContributingDeveloperAudit[];
  toolName?: string | null;
  toolVersion?: string | null;
}

interface ICreateScanResponse {
  clientHash: string;
  projectHash: string;
  branchHash: string;
  analysisId: string;
  scanType: string;
  scanUrl: string;
  scanStatusUrl: string;
  scanSarifUrl: string;
  errors: ICodedMessageModel[] | null;
}

interface IGetSupportedManifestsRequest {
  clientId: string;
}

interface IGetSupportedManifestsResponsePackageManagerManifestPatterns {
  packageManager: string;
  manifests: Array<{
    pattern: string;
    isLockFile: boolean;
  }>;
}

type IGetSupportedManifestsResponse =
  Array<IGetSupportedManifestsResponsePackageManagerManifestPatterns>;

interface IScanStatusRequest {
  scanStatusUrl: string;
}

interface IScanStatusResponse extends Pick<IScanStatusApiResponse, "status"> {
  isComplete: boolean;
  isSuccess: boolean;
  issues: IIssuesModel | null;
  errors: ICodedMessageModel[];
}

interface IScanStatusApiResponse {
  status: ScanStatus;
  issues: IIssuesModel | null;
  clientHash: string;
  projectHash: string;
  branchHash: string;
  scanId: string;
  analysisId: string;
  scanType: string;
  scanUrl: string;
  scanStatusUrl: string;
  errors: ICodedMessageModel[] | null;
}

interface IIssuesModel {
  Violation: { count: number; maxSeverity: string } | null;
  Vulnerability: { count: number; maxSeverity: string } | null;
  DependencyTypo: { count: number; maxSeverity: string } | null;
  DependencySubstitution: { count: number; maxSeverity: string } | null;
  Dast: { count: number; maxSeverity: string } | null;
  Sast: { count: number; maxSeverity: string } | null;
}

interface IStartScanRequest {
  clientId: string;
  projectHash: string;
  analysisId: string;
}

interface IUpdateScanStatusRequest {
  clientId: string;
  projectHash: string;
  branchHash: string;
  scanType: ScanType;
  scanId: string;
  status: ScanStatus;
  message: string;
}
interface IUploadManifestFilesRequest {
  clientId: string;
  projectHash: string;
  branchHash: string;
  analysisId: string;
  manifestFiles: FormData;
}
interface IUploadManifestFilesResponseManifestStatus {
  name: string;
  filename: string;
  packageManager: PackageManagerType;
  status: ManifestStatus;
  statusMessage: string;
}
interface IUploadManifestFilesResponse {
  message: string;
  manifests?: Array<IUploadManifestFilesResponseManifestStatus> | undefined;
}

interface IGetFormattedScanRequest {
  clientId: string;
  projectHash: string;
  branchHash: string;
  scanType: ScanType;
  scanId: string;
  outputFormat: OutputFormat;
}

interface IUploadScanToolResultRequest {
  clientId: string;
  projectHash: string;
  branchHash: string;
  scanType: ScanType;
  scanId: string;
  resultFile: FormData;
}

class SOOSAnalysisApiClient {
  private readonly baseUri: string;
  private readonly apiKey: string;
  private readonly client: AxiosInstance;

  constructor(apiKey: string, baseUri: string = SOOS_CONSTANTS.Urls.API.Analysis) {
    this.apiKey = apiKey;
    this.baseUri = baseUri;
    this.client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      apiClientName: "Analysis API",
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
    appVersion,
    scriptVersion,
    contributingDeveloperAudit,
    toolName,
    toolVersion,
  }: ICreateScanRequest): Promise<ICreateScanResponse> {
    const response = await this.client.post<ICreateScanResponse>(
      `clients/${clientId}/scan-types/${scanType}/scans`,
      {
        projectName: projectName,
        commitHash: commitHash,
        branch: branch,
        buildVersion: buildVersion,
        buildUri: buildUri,
        branchUri: branchUri,
        integrationType: integrationType,
        operatingEnvironment: operatingEnvironment,
        integrationName: integrationName,
        scriptVersion: scriptVersion,
        appVersion: appVersion,
        contributingDeveloperAudit: contributingDeveloperAudit,
        toolName: toolName,
        toolVersion: toolVersion,
      },
    );

    return response.data;
  }

  async getSupportedManifests({
    clientId,
  }: IGetSupportedManifestsRequest): Promise<IGetSupportedManifestsResponse> {
    const response = await this.client.get<IGetSupportedManifestsResponse>(
      `clients/${clientId}/manifests`,
    );
    return response.data;
  }

  async uploadManifestFiles({
    clientId,
    projectHash,
    analysisId,
    manifestFiles,
  }: IUploadManifestFilesRequest): Promise<IUploadManifestFilesResponse> {
    const response = await this.client.post<IUploadManifestFilesResponse>(
      `clients/${clientId}/projects/${projectHash}/analysis/${analysisId}/manifests`,
      manifestFiles,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return response.data;
  }

  async startScan({ clientId, projectHash, analysisId }: IStartScanRequest): Promise<void> {
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
  }: IUpdateScanStatusRequest): Promise<void> {
    await this.client.patch(
      `clients/${clientId}/projects/${projectHash}/branches/${branchHash}/scan-types/${scanType}/scans/${scanId}`,
      {
        status: status,
        message: message,
      },
    );
  }

  async getScanStatus({ scanStatusUrl }: IScanStatusRequest): Promise<IScanStatusResponse> {
    const response = await this.client.get<IScanStatusApiResponse>(scanStatusUrl);
    return {
      status: response.data.status,
      isComplete: CompletedScanStatuses.includes(response.data.status),
      isSuccess: response.data.status === ScanStatus.Finished,
      issues: response.data.issues,
      errors: response.data.errors ?? [],
    };
  }

  async getFormattedScanResult({
    clientId,
    projectHash,
    branchHash,
    scanType,
    scanId,
    outputFormat,
  }: IGetFormattedScanRequest): Promise<Record<string, unknown>> {
    const response = await this.client.get<Record<string, unknown>>(
      `clients/${clientId}/projects/${projectHash}/branches/${branchHash}/scan-types/${scanType}/scans/${scanId}/formats/${outputFormat}`,
    );
    return response.data;
  }

  async uploadScanToolResult({
    clientId,
    projectHash,
    branchHash,
    scanType,
    scanId,
    resultFile,
  }: IUploadScanToolResultRequest): Promise<void> {
    await this.client.put(
      `clients/${clientId}/projects/${projectHash}/branches/${branchHash}/scan-types/${scanType}/scans/${scanId}`,
      resultFile,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
  }
}

export {
  ICreateScanRequestContributingDeveloperAudit,
  ICreateScanRequest,
  ICreateScanResponse,
  IGetSupportedManifestsRequest,
  IGetSupportedManifestsResponsePackageManagerManifestPatterns,
  IGetSupportedManifestsResponse,
  IScanStatusRequest,
  IScanStatusResponse,
  IStartScanRequest,
  IUpdateScanStatusRequest,
  IUploadManifestFilesRequest,
  IUploadManifestFilesResponseManifestStatus,
  IUploadManifestFilesResponse,
  IGetFormattedScanRequest as IFormattedScanRequest,
  IUploadScanToolResultRequest,
  IIssuesModel,
};

export default SOOSAnalysisApiClient;
