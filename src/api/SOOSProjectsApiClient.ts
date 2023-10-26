import { AxiosInstance } from "axios";
import { SOOS_URLS } from "../constants";
import SOOSApiClient from "./SOOSApiClient";

interface IGetProjectSettingsRequest {
  clientId: string;
  projectHash: string;
}

// NOTE: many settings are returned, but we don't need them yet
interface IGetProjectSettingsResponse {
  useLockFile?: boolean;
}

class SOOSProjectsApiClient {
  private readonly baseUri: string;
  private readonly apiKey: string;
  private readonly client: AxiosInstance;

  constructor(apiKey: string, baseUri: string = SOOS_URLS.API.Projects) {
    this.apiKey = apiKey;
    this.baseUri = baseUri;
    this.client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      apiClientName: "Projects API",
    });
  }

  async getProjectSettings({
    clientId,
    projectHash,
  }: IGetProjectSettingsRequest): Promise<IGetProjectSettingsResponse> {
    const response = await this.client.get<IGetProjectSettingsResponse>(
      `clients/${clientId}/projects/${projectHash}/settings?fallback=true`,
    );

    return response.data;
  }
}

export { IGetProjectSettingsRequest, IGetProjectSettingsResponse };

export default SOOSProjectsApiClient;
