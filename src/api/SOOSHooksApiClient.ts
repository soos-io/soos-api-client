import { AxiosInstance } from "axios";
import { SOOS_CONSTANTS } from "../constants";
import SOOSApiClient from "./SOOSApiClient";

interface IContributorAuditMetadata {
  scriptVersion: string;
  days: number;
}

interface IContributorAuditModel {
  metadata: IContributorAuditMetadata;
  organizationName: string;
  contributors: IContributorAuditRepositories[];
}

interface IContributorAuditRepositories {
  username: string;
  repositories: IContributorAuditRepository[];
}

interface IContributorAuditRepository {
  id: string;
  name: string;
  lastCommit: string;
  isPrivate: boolean;
}

class SOOSHooksApiClient {
  private readonly baseUri: string;
  private readonly apiKey: string;
  private readonly client: AxiosInstance;

  constructor(apiKey: string, baseUri: string = SOOS_CONSTANTS.Urls.API.Hooks) {
    this.apiKey = apiKey;
    this.baseUri = baseUri;
    this.client = SOOSApiClient.create({
      baseUri: this.baseUri,
      apiKey: this.apiKey,
      apiClientName: "Hooks API",
    });
  }

  async postContributorAudits(
    clientHash: string,
    contributorAudit: IContributorAuditModel,
  ): Promise<void> {
    await this.client.post<void>(`clients/${clientHash}/contributor-audits`, contributorAudit);
  }
}

export {
  IContributorAuditModel,
  IContributorAuditMetadata,
  IContributorAuditRepositories,
  IContributorAuditRepository,
};

export default SOOSHooksApiClient;
