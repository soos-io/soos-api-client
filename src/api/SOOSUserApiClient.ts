import { AxiosInstance } from "axios";
import { SOOS_CONSTANTS } from "../constants";
import SOOSApiClient from "./SOOSApiClient";
import { SeverityEnum } from "../enums";

interface IApplicationStatusMessage {
  message: string;
  severity: SeverityEnum;
  isDismissible: boolean;
  url: string | null;
  linkText: string | null;
}

interface IApplicationStatusModel {
  statusMessage: IApplicationStatusMessage | null;
  clientMessage: IApplicationStatusMessage | null;
}

class SOOSUserApiClient {
  private readonly baseUri: string;
  private readonly apiKey: string;
  private readonly client: AxiosInstance;

  constructor(apiKey: string, baseUri: string = SOOS_CONSTANTS.Urls.API.User) {
    this.apiKey = apiKey;
    this.baseUri = baseUri;
    this.client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      apiClientName: "User API",
    });
  }

  async getApplicationStatus(clientHash: string): Promise<IApplicationStatusModel> {
    try {
      const response = await this.client.get<IApplicationStatusModel>(
        `clients/${clientHash}/application-status`,
      );

      return response.data;
    } catch {
      return {
        clientMessage: null,
        statusMessage: {
          message:
            "Please verify your API Key and Client ID. Contact support@soos.io if you continue to receive this error.",
          severity: SeverityEnum.High,
          isDismissible: false,
          linkText: "",
          url: "",
        },
      };
    }
  }
}

export { IApplicationStatusModel, IApplicationStatusMessage };

export default SOOSUserApiClient;
