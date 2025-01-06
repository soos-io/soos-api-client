import { SOOS_CONSTANTS } from "../constants";
import { AttributionFileTypeEnum, AttributionFormatEnum, AttributionStatusEnum } from "../enums";
import { AxiosInstance } from "axios";
import SOOSApiClient from "./SOOSApiClient";

interface IPostScanAttributionRequest {
  clientId: string;
  projectHash: string;
  branchHash: string;
  scanId: string;
  format: AttributionFormatEnum;
  fileType: AttributionFileTypeEnum;
  includeDependentProjects?: boolean;
  includeVulnerabilities?: boolean;
  includeOriginalSbom?: boolean;
}

interface IAttributionStatusModel {
  id: string;
  filename: string | null;
  status: AttributionStatusEnum;
  statusDescription: string | null;
  statusLastUpdated: string;
  message: string | null;
  requestedBy: string | null;
  requestedAt: string;
}

interface IGetAnalysisAttributionStatusRequest {
  clientId: string;
  projectHash: string;
  branchHash: string;
  scanId: string;
  attributionId: string;
}

interface IGetAnalysisAttributionRequest {
  clientId: string;
  projectHash: string;
  branchHash: string;
  scanId: string;
  attributionId: string;
}

class SOOSAttributionApiClient {
  private readonly baseUri: string;
  private readonly apiKey: string;
  private readonly client: AxiosInstance;

  constructor(apiKey: string, baseUri: string = SOOS_CONSTANTS.Urls.API.Analysis) {
    this.apiKey = apiKey;
    this.baseUri = baseUri;
    this.client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      apiClientName: "Analysis Attribution API",
    });
  }

  async createAttributionRequest({
    clientId,
    projectHash,
    branchHash,
    scanId,
    format,
    fileType,
    includeDependentProjects,
    includeVulnerabilities,
    includeOriginalSbom,
  }: IPostScanAttributionRequest): Promise<IAttributionStatusModel> {
    const response = await this.client.post<IAttributionStatusModel>(
      `clients/${clientId}/projects/${projectHash}/branches/${branchHash}/scans/${scanId}/attributions`,
      {
        format,
        fileType,
        includeDependentProjects,
        includeVulnerabilities,
        includeOriginalSbom,
      },
    );

    return response.data;
  }

  async getAttributionStatus({
    clientId,
    projectHash,
    branchHash,
    scanId,
    attributionId,
  }: IGetAnalysisAttributionStatusRequest): Promise<IAttributionStatusModel> {
    const response = await this.client.get<IAttributionStatusModel>(
      `clients/${clientId}/projects/${projectHash}/branches/${branchHash}/scans/${scanId}/attributions/${attributionId}/status`,
    );

    return response.data;
  }

  async getScanAttribution({
    clientId,
    projectHash,
    branchHash,
    scanId,
    attributionId,
  }: IGetAnalysisAttributionRequest): Promise<Blob> {
    const response = await this.client.get<Blob>(
      `clients/${clientId}/projects/${projectHash}/branches/${branchHash}/scans/${scanId}/attributions/${attributionId}`,
    );

    return response.data;
  }
}

export {
  IAttributionStatusModel,
  IPostScanAttributionRequest,
  IGetAnalysisAttributionStatusRequest,
};

export default SOOSAttributionApiClient;
