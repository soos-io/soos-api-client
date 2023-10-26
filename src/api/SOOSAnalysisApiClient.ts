import { SOOS_URLS } from "../constants";
import FormData from "form-data";
import { ManifestStatus, PackageManagerType, ScanStatus, ScanType } from "../enums";
import { AxiosInstance } from "axios";
import { ICodedMessageModel } from "../models";
import { isNil } from "../utilities";
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
  integrationName: string | null;
  scriptVersion: string | null;
  appVersion: string | null;
  contributingDeveloperAudit?: ICreateScanRequestContributingDeveloperAudit[];
}

interface ICreateScanResponse {
  clientHash: string;
  projectHash: string;
  branchHash: string;
  analysisId: string;
  scanType: string;
  scanUrl: string;
  scanStatusUrl: string;
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
  reportStatusUrl: string;
}

interface IScanStatusResponse extends Pick<ICheckAnalysisScanStatusReturn, "status"> {
  isComplete: boolean;
  isSuccess: boolean;
  hasIssues: boolean;
  violations: number;
  vulnerabilities: number;
  errors: ICodedMessageModel[];
}

interface ICheckAnalysisScanStatusReturn {
  status: ScanStatus;
  violations: { count: number } | null;
  vulnerabilities: { count: number } | null;
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

class SOOSAnalysisApiClient {
  private readonly baseUri: string;
  private readonly apiKey: string;
  private readonly client: AxiosInstance;

  constructor(apiKey: string, baseUri: string = SOOS_URLS.API.Analysis) {
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
    appVersion,
    scriptVersion,
    contributingDeveloperAudit,
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
    const headers: FormData.Headers = await new Promise((resolve) =>
      manifestFiles.getLength((error, length) =>
        isNil(error) && !isNil(length)
          ? resolve(manifestFiles.getHeaders({ "Content-Length": length.toString() }))
          : resolve(manifestFiles.getHeaders()),
      ),
    );

    const response = await this.client.post<IUploadManifestFilesResponse>(
      `clients/${clientId}/projects/${projectHash}/analysis/${analysisId}/manifests`,
      manifestFiles,
      {
        headers: headers,
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

  async getScanStatus({ reportStatusUrl }: IScanStatusRequest): Promise<IScanStatusResponse> {
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
