import axios, { AxiosInstance, AxiosResponse } from "axios";
import { soosLogger } from "../../../../logging/SOOSLogger";
import { DateUtilities, sleep } from "../../../../utilities";
import { SOOS_BITBUCKET_CONTRIBUTOR_AUDIT_CONSTANTS } from "./constants";
import {
  IContributorAuditRepositories,
  IContributorAuditRepository,
} from "../../../../api/SOOSHooksApiClient";

interface IBitbucketHttpRequestParameters {
  baseUri: string;
  username: string;
  password: string;
}

interface IHttpClientParameters extends IBitbucketHttpRequestParameters {
  apiClientName: string;
  dateToFilter: string;
}

export interface BaseBitBucketApiResponse {
  type: (typeof BitbucketResponseTypes)[keyof typeof BitbucketResponseTypes];
  values: BitbucketRepository[] | BitbucketCommit[];
  next?: string;
}

export const BitbucketResponseTypes = {
  Commit: "commit",
  Repository: "repository",
} as const;

// NOTE: Bitbucket related interfaces do not represent the full response from Bitbucket, only the fields we care about
export interface BitBucketRepositoryApiResponse extends BaseBitBucketApiResponse {
  type: typeof BitbucketResponseTypes.Repository;
  values: BitbucketRepository[];
}

export interface BitbucketRepository {
  uuid: string;
  full_name: string;
  name: string;
  is_private: boolean;
  updated_on: string;
  workspace: BitbucketWorkspace;
}

export interface BitbucketWorkspace {
  type: string;
  uuid: string;
  name: string;
  slug: string;
}

export interface BitbucketCommitsApiResponse extends BaseBitBucketApiResponse {
  type: typeof BitbucketResponseTypes.Commit;
  values: BitbucketCommit[];
}

export interface BitbucketCommit {
  author: BitbucketAuthor;
  date: string;
}

export interface BitbucketAuthor {
  raw: string;
  name: string;
  emailAddress: string;
  displayName: string;
  user: BitbucketUser;
}

interface BitbucketUser {
  display_name: string;
  type: string;
  nickname: string;
}

class BitbucketApiClient {
  private readonly client: AxiosInstance;
  private readonly workspace: string;
  private readonly days: number;
  private readonly dateToFilter: string;

  constructor(
    days: number,
    username: string,
    password: string,
    workspace: string,
    baseUri: string = SOOS_BITBUCKET_CONTRIBUTOR_AUDIT_CONSTANTS.Urls.API.Base,
  ) {
    this.workspace = workspace;
    this.days = days;
    this.dateToFilter = DateUtilities.getDate(this.days).toISOString();
    this.client = BitbucketApiClient.createHttpClient({
      baseUri,
      username: username,
      password: password,
      apiClientName: "Bitbucket API",
      dateToFilter: this.dateToFilter,
    });
  }

  private static createHttpClient({
    baseUri,
    username,
    password,
    apiClientName,
    dateToFilter,
  }: IHttpClientParameters) {
    const client = axios.create({
      baseURL: baseUri,
      auth: {
        username: username,
        password: password,
      },
    });

    client.interceptors.response.use(
      async (response) => {
        soosLogger.verboseDebug(apiClientName, `Response Body: ${JSON.stringify(response.data)}`);
        if (response.data.next) {
          return await this.handlePagination(response, client, dateToFilter);
        }
        return response;
      },
      async (error) => {
        const { config, response } = error;
        const maxRetries = 3;
        config.retryCount = config.retryCount || 0;

        if (response?.status === 429 && config.retryCount < maxRetries) {
          soosLogger.verboseDebug(
            apiClientName,
            `Rate limit exceeded on the Bitbucket API. Waiting ${SOOS_BITBUCKET_CONTRIBUTOR_AUDIT_CONSTANTS.RetrySeconds} seconds before retrying. Retry count: ${config.retryCount}`,
          );

          config.retryCount += 1;
          await sleep(SOOS_BITBUCKET_CONTRIBUTOR_AUDIT_CONSTANTS.RetrySeconds * 1000);
          return client(config);
        }

        if (response?.status) {
          soosLogger.verboseDebug(apiClientName, `Response Status: ${response.status}`);
        }
        return Promise.reject(error);
      },
    );

    return client;
  }

  async getBitbucketRepositories(): Promise<BitbucketRepository[]> {
    const response = await this.client.get<BitBucketRepositoryApiResponse>(
      `repositories/${this.workspace}`,
    );

    const repoResponse: BitBucketRepositoryApiResponse = response.data;

    const repos: BitbucketRepository[] = repoResponse.values.filter(
      (repo) => new Date(repo.updated_on) >= new Date(this.dateToFilter),
    );

    return repos;
  }

  async getBitbucketRepositoryContributors(
    repository: BitbucketRepository,
  ): Promise<IContributorAuditRepositories[]> {
    const response = await this.client.get<BitbucketCommitsApiResponse>(
      `repositories/${this.workspace}/${repository.name}/commits`,
    );

    response.data.values = response.data.values.filter(
      (commit) => new Date(commit.date) >= new Date(this.dateToFilter),
    );

    const commits: BitbucketCommitsApiResponse = response.data;

    const contributors = commits.values.reduce<IContributorAuditRepositories[]>((acc, commit) => {
      const username = commit.author.user ? commit.author.user.display_name : "Unknown Author";
      const commitDate = commit.date;

      const repo: IContributorAuditRepository = {
        id: repository.uuid,
        name: repository.name,
        lastCommit: commitDate,
        isPrivate: repository.is_private,
      };

      let contributor = acc.find((c) => c.username === username);

      if (!contributor) {
        contributor = { username, repositories: [repo] };
        acc.push(contributor);
      } else {
        const existingRepository = contributor.repositories.find((r) => r.id === repo.id);
        if (!existingRepository) {
          contributor.repositories.push(repo);
        } else {
          if (new Date(existingRepository.lastCommit) < new Date(commitDate)) {
            existingRepository.lastCommit = commitDate;
          }
        }
      }

      return acc;
    }, []);

    return contributors;
  }

  private static async handlePagination<T extends BaseBitBucketApiResponse>(
    response: AxiosResponse<T>,
    client: AxiosInstance,
    dateToFilter: string,
  ): Promise<AxiosResponse<T>> {
    let data = response.data;
    let nextUrl = data.next;
    let notOnDateRange = false;

    while (nextUrl && !notOnDateRange) {
      soosLogger.verboseDebug("Fetching next page", nextUrl);
      const nextPageResponse = await client.get<T>(nextUrl);

      if (data.type === BitbucketResponseTypes.Commit) {
        data.values = (data.values as BitbucketCommit[]).concat(
          nextPageResponse.data.values as BitbucketCommit[],
        );
        notOnDateRange = (data.values as BitbucketCommit[]).some(
          (commit) => new Date(commit.date) < new Date(dateToFilter),
        );
      } else if (data.type === BitbucketResponseTypes.Repository) {
        data.values = (data.values as BitbucketRepository[]).concat(
          nextPageResponse.data.values as BitbucketRepository[],
        );
        notOnDateRange = (data.values as BitbucketRepository[]).some(
          (repo) => new Date(repo.updated_on) < new Date(dateToFilter),
        );
      }

      nextUrl = nextPageResponse.data.next ?? undefined;
    }

    return { ...response, data };
  }
}

export default BitbucketApiClient;
