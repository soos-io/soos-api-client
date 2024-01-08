import axios, { AxiosInstance } from "axios";
import { soosLogger } from "../../../../../logging/SOOSLogger";

interface IHttpRequestParameters {
  baseUri: string;
  githubPAT: string;
}

interface IHttpClientParameters extends IHttpRequestParameters {
  apiClientName: string;
}

export interface GitHubOrganization {
  login: string;
}

class GitHubApiClient {
  private readonly client: AxiosInstance;

  constructor(githubPAT: string, baseUri: string = "https://api.github.com") {
    this.client = GitHubApiClient.createHttpClient({
      baseUri,
      githubPAT,
      apiClientName: "GitHub API",
    });
  }

  private static createHttpClient({ baseUri, githubPAT, apiClientName }: IHttpClientParameters) {
    const client = axios.create({
      baseURL: baseUri,
      headers: {
        accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubPAT}`,
      },
    });

    client.interceptors.request.use(
      (request) => {
        if (request.data) {
          soosLogger.verboseDebug(
            apiClientName,
            `Request URL: ${request.method?.toLocaleUpperCase()} ${request.url}`,
          );
          if (request.params) {
            soosLogger.verboseDebug(
              apiClientName,
              `Request Params: ${JSON.stringify(request.params)}`,
            );
          }
          soosLogger.verboseDebug(apiClientName, `Request Body: ${JSON.stringify(request.data)}`);
        }
        return request;
      },
      (rejectedRequest) => {
        return Promise.reject(rejectedRequest);
      },
    );

    client.interceptors.response.use(
      (response) => {
        soosLogger.verboseDebug(apiClientName, `Response Body: ${JSON.stringify(response.data)}`);
        return response;
      },
      (rejectedResponse) => {
        if (rejectedResponse.response?.status) {
          soosLogger.verboseDebug(
            apiClientName,
            `Response Status: ${rejectedResponse.response?.status}`,
          );
        }
        return Promise.reject(rejectedResponse);
      },
    );

    return client;
  }

  async getGithubOrgs(): Promise<GitHubOrganization[]> {
    const response = await this.client.get<GitHubOrganization[]>(`/user/orgs?per_page=100`);

    const orgs: GitHubOrganization[] = await response.data;
    soosLogger.verboseDebug(`GitHub orgs response: ${JSON.stringify(orgs)}`);
    return orgs;
  }
}

export default GitHubApiClient;
