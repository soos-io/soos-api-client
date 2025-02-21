import axios, { AxiosInstance, AxiosResponse } from "axios";
import { soosLogger } from "../../../../logging/SOOSLogger";
import { DateUtilities, sleep } from "../../../../utilities";
import { SOOS_BITBUCKET_CLOUD_CONTRIBUTOR_AUDIT_CONSTANTS } from "./constants";
import {
  IContributorAuditRepositories,
  IContributorAuditRepository,
} from "../../../../api/SOOSHooksApiClient";
import { DataMappingUtilities } from "../../utilities";

interface IBitbucketCloudHttpRequestParameters {
  baseUri: string;
  username: string;
  password: string;
}

interface IHttpClientParameters extends IBitbucketCloudHttpRequestParameters {
  apiClientName: string;
  dateToFilter: string;
}

// NOTE: BitbucketCloud related interfaces do not represent the full response from BitbucketCloud, only the fields we care about
export interface BitbucketRepositoryApiResponse {
  values: BitbucketCloudRepository[];
  next?: string;
}

export interface BitbucketCloudRepository {
  uuid: string;
  full_name: string;
  name: string;
  is_private: boolean;
  updated_on: string;
  workspace: BitbucketCloudWorkspace;
}

export interface BitbucketCloudWorkspace {
  type: string;
  uuid: string;
  name: string;
  slug: string;
}

export interface BitbucketCloudCommitsApiResponse {
  values: BitbucketCloudCommit[];
  next?: string;
}

export interface BitbucketCloudCommit {
  author: BitbucketCloudAuthor;
  date: string;
}

export interface BitbucketCloudAuthor {
  raw: string;
  name: string;
  emailAddress: string;
  displayName: string;
  user: BitbucketCloudUser;
}

interface BitbucketCloudUser {
  display_name: string;
  type: string;
  nickname: string;
}

class BitbucketCloudApiClient {
  private readonly client: AxiosInstance;
  private readonly workspace: string;
  private readonly days: number;
  private readonly dateToFilter: string;

  constructor(
    days: number,
    username: string,
    password: string,
    workspace: string,
    baseUri: string = SOOS_BITBUCKET_CLOUD_CONTRIBUTOR_AUDIT_CONSTANTS.Urls.API.Base,
  ) {
    this.workspace = workspace;
    this.days = days;
    this.dateToFilter = DateUtilities.getDate(this.days).toISOString();
    this.client = BitbucketCloudApiClient.createHttpClient({
      baseUri,
      username: username,
      password: password,
      apiClientName: "BitbucketCloud API",
      dateToFilter: this.dateToFilter,
    });
  }

  private static createHttpClient({ baseUri, username, password }: IHttpClientParameters) {
    const client = axios.create({
      baseURL: baseUri,
      auth: {
        username: username,
        password: password,
      },
    });

    return client;
  }

  async getBitbucketCloudRepositories(): Promise<BitbucketCloudRepository[]> {
    this.client.interceptors.response.use((response) => {
      if (response.data.next) {
        return BitbucketCloudApiClient.handleRepositoryPagination(
          response,
          this.client,
          this.dateToFilter,
        );
      }
      return response;
    });
    const response = await this.client.get<BitbucketRepositoryApiResponse>(
      `repositories/${this.workspace}`,
    );

    const repoResponse: BitbucketRepositoryApiResponse = response.data;

    const repos: BitbucketCloudRepository[] = repoResponse.values.filter((repo) =>
      DateUtilities.isWithinDateRange(new Date(repo.updated_on), new Date(this.dateToFilter)),
    );

    return repos;
  }

  async getBitbucketCloudRepositoryContributors(
    repository: BitbucketCloudRepository,
  ): Promise<IContributorAuditRepositories[]> {
    await this.setupInterceptor(
      this.client,
      "BitbucketCloud API",
      this.dateToFilter,
      this.handleCommitPagination,
    );
    const response = await this.client.get<BitbucketCloudCommitsApiResponse>(
      `repositories/${this.workspace}/${repository.name}/commits`,
    );

    response.data.values = response.data.values.filter((commit) =>
      DateUtilities.isWithinDateRange(new Date(commit.date), new Date(this.dateToFilter)),
    );

    const commits: BitbucketCloudCommitsApiResponse = response.data;

    const contributors = commits.values.reduce<IContributorAuditRepositories[]>((acc, commit) => {
      const username = commit.author.user ? commit.author.user.display_name : "Unknown Author";
      const commitDate = commit.date;

      const repo: IContributorAuditRepository = {
        id: repository.uuid,
        name: repository.name,
        lastCommit: commitDate,
        isPrivate: repository.is_private,
      };

      return DataMappingUtilities.updateContributors(acc, repo, username, commitDate);
    }, []);

    return contributors;
  }

  private async setupInterceptor(
    client: AxiosInstance,
    apiClientName: string,
    dateToFilter: string,
    paginationFunction: (
      response: AxiosResponse,
      client: AxiosInstance,
      dateToFilter: string,
    ) => Promise<AxiosResponse>,
  ): Promise<void> {
    client.interceptors.response.clear();
    client.interceptors.response.use(
      async (response) => {
        soosLogger.debug(apiClientName, `Response Body: ${JSON.stringify(response.data)}`);
        if (response.data.next) {
          return await paginationFunction(response, client, dateToFilter);
        }
        return response;
      },
      async (error) => {
        const { config, response } = error;
        const maxRetries = 3;
        config.retryCount = config.retryCount || 0;

        if (response?.status === 429 && config.retryCount < maxRetries) {
          soosLogger.debug(
            apiClientName,
            `Rate limit exceeded on the BitbucketCloud API. Waiting ${SOOS_BITBUCKET_CLOUD_CONTRIBUTOR_AUDIT_CONSTANTS.RetrySeconds} seconds before retrying. Retry count: ${config.retryCount}`,
          );

          config.retryCount += 1;
          await sleep(SOOS_BITBUCKET_CLOUD_CONTRIBUTOR_AUDIT_CONSTANTS.RetrySeconds * 1000);
          return client(config);
        }

        if (response?.status) {
          soosLogger.debug(apiClientName, `Response Status: ${response.status}`);
        }
        return Promise.reject(error);
      },
    );
  }

  private static async handleRepositoryPagination(
    response: AxiosResponse<BitbucketRepositoryApiResponse>,
    client: AxiosInstance,
    dateToFilter: string,
  ): Promise<AxiosResponse> {
    const data = response.data;
    let nextUrl = data.next;
    let isWithinDateRange = data.values.every((repo) =>
      DateUtilities.isWithinDateRange(new Date(repo.updated_on), new Date(dateToFilter)),
    );

    while (nextUrl && isWithinDateRange) {
      soosLogger.debug("Fetching next page", nextUrl);
      const nextPageResponse = await client.get<BitbucketRepositoryApiResponse>(nextUrl);
      data.values = data.values.concat(nextPageResponse.data.values);
      nextUrl = nextPageResponse.data.next ?? undefined;
      isWithinDateRange = nextPageResponse.data.values.every((repo) =>
        DateUtilities.isWithinDateRange(new Date(repo.updated_on), new Date(dateToFilter)),
      );
    }

    return { ...response, data };
  }

  private async handleCommitPagination(
    response: AxiosResponse<BitbucketCloudCommitsApiResponse>,
    client: AxiosInstance,
    dateToFilter: string,
  ): Promise<AxiosResponse> {
    const data = response.data;
    let nextUrl = data.next;
    let lastCommitDate = new Date(data.values[data.values.length - 1].date);
    let isWithinDateRange = DateUtilities.isWithinDateRange(lastCommitDate, new Date(dateToFilter));

    while (nextUrl && isWithinDateRange) {
      soosLogger.debug("Fetching next page", nextUrl);
      const nextPageResponse = await client.get<BitbucketCloudCommitsApiResponse>(nextUrl);
      data.values = data.values.concat(nextPageResponse.data.values);
      soosLogger.debug(
        `Checking if commits are within date range min date ${new Date(dateToFilter)}`,
      );
      lastCommitDate = new Date(
        nextPageResponse.data.values[nextPageResponse.data.values.length - 1].date,
      );
      isWithinDateRange = DateUtilities.isWithinDateRange(lastCommitDate, new Date(dateToFilter));
      nextUrl = nextPageResponse.data.next ?? undefined;
    }

    return { ...response, data };
  }
}

export default BitbucketCloudApiClient;
