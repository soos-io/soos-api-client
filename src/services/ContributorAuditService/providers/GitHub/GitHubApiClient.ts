import axios, { AxiosInstance, AxiosResponse } from "axios";
import { soosLogger } from "../../../../logging/SOOSLogger";
import { DateUtilities, sleep } from "../../../../utilities";
import { SOOS_GITHUB_CONTRIBUTOR_AUDIT_CONSTANTS } from "./constants";
import {
  IContributorAuditRepositories,
  IContributorAuditRepository,
} from "../../../../api/SOOSHooksApiClient";

interface IHttpRequestParameters {
  baseUri: string;
  gitHubPAT: string;
}

interface IHttpClientParameters extends IHttpRequestParameters {
  apiClientName: string;
}

// NOTE: GitHub related interfaces do not represent the full response from GitHub, only the fields we care about
export interface GitHubOrganization {
  login: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubOrganization;
  pushed_at: string;
}

export interface Commits {
  commit: {
    author: Author;
  };
}

export interface Author {
  name: string;
  email: string;
  date: string;
}

class GitHubApiClient {
  private readonly client: AxiosInstance;
  private readonly organizationName: string;
  private readonly days: number;
  private readonly dateToFilter: string;

  constructor(
    days: number,
    gitHubPAT: string,
    organizationName: string,
    baseUri: string = SOOS_GITHUB_CONTRIBUTOR_AUDIT_CONSTANTS.Urls.API.Base,
  ) {
    this.client = GitHubApiClient.createHttpClient({
      baseUri,
      gitHubPAT: gitHubPAT,
      apiClientName: "GitHub API",
    });
    this.organizationName = organizationName;
    this.days = days;
    this.dateToFilter = DateUtilities.getDate(this.days).toISOString();
  }

  private static createHttpClient({
    baseUri,
    gitHubPAT: gitHubPAT,
    apiClientName,
  }: IHttpClientParameters) {
    const client = axios.create({
      baseURL: baseUri,
      headers: {
        accept: "application/vnd.github+json",
        Authorization: `Bearer ${gitHubPAT}`,
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
      async (response) => {
        soosLogger.verboseDebug(apiClientName, `Response Body: ${JSON.stringify(response.data)}`);
        if (response.config.url?.includes("per_page")) {
          return await GitHubApiClient.handlePagination(response, client);
        }
        return response;
      },
      async (error) => {
        const { config, response } = error;
        const maxRetries = 3;
        config.retryCount = config.retryCount || 0;

        if (
          (response?.status === 429 || response?.status === 403) &&
          config.retryCount < maxRetries
        ) {
          const rateLimitReset = response?.headers["x-ratelimit-reset"] as number;
          if (rateLimitReset) {
            soosLogger.verboseDebug(`Trying to parse rate limit reset: ${rateLimitReset}`);
            const rateLimitDate = DateUtilities.getDateFromUnixUTC(rateLimitReset);
            const timeToWait = Math.floor((rateLimitDate.getTime() - Date.now()) / 1000);
            soosLogger.verboseDebug(
              apiClientName,
              `Rate limit exceeded on the GitHub API. Waiting ${timeToWait} seconds before retrying. Retry count: ${config.retryCount}`,
            );
            config.retryCount += 1;
            await sleep(timeToWait * 1000);
          }
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

  private static async handlePagination(
    response: AxiosResponse,
    client: AxiosInstance,
  ): Promise<AxiosResponse> {
    let data = response.data;
    let nextUrl = GitHubApiClient.getNextPageUrl(response);
    while (nextUrl) {
      soosLogger.verboseDebug("Fetching next page", nextUrl);
      const nextPageResponse = await client.get(nextUrl);
      data = data.concat(nextPageResponse.data);
      nextUrl = GitHubApiClient.getNextPageUrl(nextPageResponse);
    }

    return { ...response, data };
  }

  private static getNextPageUrl(response: AxiosResponse): string | null {
    const linkHeader = response.headers["link"] as string | undefined;
    const nextLink = linkHeader?.split(",").find((s) => s.includes('rel="next"'));
    return nextLink
      ? new URL(nextLink.split(";")[0].trim().slice(1, -1), response.config.baseURL).toString()
      : null;
  }

  async getGitHubOrganizations(): Promise<GitHubOrganization[]> {
    const response = await this.client.get<GitHubOrganization[]>(`user/orgs?per_page=100`);

    const orgs: GitHubOrganization[] = response.data.filter(
      (org) => org.login === this.organizationName,
    );

    if (orgs.length === 0) {
      throw new Error(`Organization ${this.organizationName} not found`);
    }

    return orgs;
  }

  async getGitHubOrganizationRepositories(
    organization: GitHubOrganization,
  ): Promise<GitHubRepository[]> {
    const response = await this.client.get<GitHubRepository[]>(
      `orgs/${organization.login}/repos?per_page=50`,
    );

    const repos: GitHubRepository[] = response.data.filter(
      (repo) => new Date(repo.pushed_at) >= new Date(this.dateToFilter),
    );

    return repos;
  }

  async getGitHubRepositoryContributors(
    repository: GitHubRepository,
  ): Promise<IContributorAuditRepositories[]> {
    const response = await this.client.get<Commits[]>(
      `repos/${repository.owner.login}/${repository.name}/commits?per_page=100&since=${this.dateToFilter}`,
    );

    const commits: Commits[] = await response.data;

    const contributors = commits.reduce<IContributorAuditRepositories[]>((acc, commit) => {
      const username = commit.commit.author.name;
      const commitDate = commit.commit.author.date;

      const repo: IContributorAuditRepository = {
        id: repository.id,
        name: repository.name,
        lastCommit: commitDate,
        isPrivate: repository.private,
      };

      let contributor = acc.find((contributor) => contributor.username === username);

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
}

export default GitHubApiClient;
