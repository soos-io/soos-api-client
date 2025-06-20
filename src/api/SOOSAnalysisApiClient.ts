import { SOOS_CONSTANTS } from "../constants";
import FormData from "form-data";
import {
  HashAlgorithmEnum,
  HashEncodingEnum,
  IntegrationName,
  IntegrationType,
  ManifestStatus,
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
  integrationType: IntegrationType;
  operatingEnvironment: string;
  integrationName: IntegrationName;
  scriptVersion: string | null;
  appVersion: string | null;
  contributingDeveloperAudit?: ICreateScanRequestContributingDeveloperAudit[];
  toolName?: string | null;
  toolVersion?: string | null;
  commandLine?: string | null;
  scanMode?: string | null;
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

interface IGetSupportedScanFileFormatsRequest {
  clientId: string;
}

interface IGetSupportedScanFileFormatsResponsePackageManagerManifestAndHashableFiles {
  packageManager: PackageManagerType;
  manifests: Array<{
    pattern: string;
    isLockFile: boolean;
    includeWithLockFiles: boolean;
    SupportsLockFiles: boolean;
  }>;
  hashableFiles: Array<{
    hashAlgorithms: Array<{
      hashAlgorithm: HashAlgorithmEnum;
      bufferEncoding: HashEncodingEnum;
      digestEncoding: HashEncodingEnum;
    }>;
    archiveFileExtensions: Array<string> | null;
    archiveContentFileExtensions: Array<string> | null;
  }> | null;
}

type IGetSupportedScanFileFormatsResponse =
  Array<IGetSupportedScanFileFormatsResponsePackageManagerManifestAndHashableFiles>;

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
  Dast: { count: number; maxSeverity: string } | null;
  MaliciousPackage: { count: number; maxSeverity: string } | null;
  Sast: { count: number; maxSeverity: string } | null;
  Violation: { count: number; maxSeverity: string } | null;
  Vulnerability: { count: number; maxSeverity: string } | null;
  UnknownPackage: { count: number; maxSeverity: string } | null;
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
  hasMoreThanMaximumManifests: boolean;
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

interface IUploadScanToolResultRequest {
  clientId: string;
  projectHash: string;
  branchHash: string;
  scanType: ScanType;
  scanId: string;
  resultFile: FormData;
  hasMoreThanMaximumFiles: boolean;
}

class SOOSAnalysisApiClient {
  private readonly baseUri: string;
  private readonly apiKey: string;
  private readonly client: AxiosInstance;

  private createApiClient = (skipDebugRequestLogging: boolean): AxiosInstance =>
    SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      apiClientName: "Analysis API",
      skipDebugRequestLogging,
    });

  constructor(apiKey: string, baseUri: string = SOOS_CONSTANTS.Urls.API.Analysis) {
    this.apiKey = apiKey;
    this.baseUri = baseUri;
    this.client = this.createApiClient(false);
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
    commandLine,
    scanMode,
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
        commandLine: commandLine,
        scanMode: scanMode,
      },
    );

    return response.data;
  }

  async getSupportedScanFileFormats({
    clientId,
  }: IGetSupportedScanFileFormatsRequest): Promise<IGetSupportedScanFileFormatsResponse> {
    const response = await this.client.get<IGetSupportedScanFileFormatsResponse>(
      `clients/${clientId}/scan-file-formats`,
    );
    return response.data;
  }

  async uploadManifestFiles({
    clientId,
    projectHash,
    analysisId,
    manifestFiles,
    hasMoreThanMaximumManifests,
  }: IUploadManifestFilesRequest): Promise<IUploadManifestFilesResponse> {
    const response = await this.client.post<IUploadManifestFilesResponse>(
      `clients/${clientId}/projects/${projectHash}/analysis/${analysisId}/manifests`,
      manifestFiles,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        params: {
          hasMoreThanMaximumManifests: hasMoreThanMaximumManifests ? "true" : "false",
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

  async uploadScanToolResult({
    clientId,
    projectHash,
    branchHash,
    scanType,
    scanId,
    resultFile,
    hasMoreThanMaximumFiles,
  }: IUploadScanToolResultRequest): Promise<void> {
    const client = this.createApiClient(true); // these requests are huge, don't log them
    await client.put(
      `clients/${clientId}/projects/${projectHash}/branches/${branchHash}/scan-types/${scanType}/scans/${scanId}`,
      resultFile,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        params: {
          hasMoreThanMaximumFiles: hasMoreThanMaximumFiles ? "true" : "false",
        },
      },
    );
  }
}

export {
  ICreateScanRequestContributingDeveloperAudit,
  ICreateScanRequest,
  ICreateScanResponse,
  IGetSupportedScanFileFormatsRequest,
  IGetSupportedScanFileFormatsResponsePackageManagerManifestAndHashableFiles,
  IGetSupportedScanFileFormatsResponse,
  IScanStatusRequest,
  IScanStatusResponse,
  IStartScanRequest,
  IUpdateScanStatusRequest,
  IUploadManifestFilesRequest,
  IUploadManifestFilesResponseManifestStatus,
  IUploadManifestFilesResponse,
  IUploadScanToolResultRequest,
  IIssuesModel,
};

export default SOOSAnalysisApiClient;
