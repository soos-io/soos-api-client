import axios, { AxiosInstance, AxiosResponse } from "axios";
import { soosLogger } from "../../../../../logging/SOOSLogger";
import { sleep } from "../../../../../utilities";

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

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubOrganization;
}

export interface ContributingDeveloper {
  username: string;
  repositories: ContributingDeveloperRepositories[];
}

interface ContributingDeveloperRepositories {
  id: number;
  name: string;
  lastCommit: string;
  isPrivate: boolean;
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

export const threeMonthsDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return `${d.getUTCFullYear()}-${
    d.getMonth() + 1
  }-${d.getUTCDate()}T${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}Z`;
})();

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

        if (response?.status === 429 && config.retryCount < maxRetries) {
          config.retryCount += 1;
          soosLogger.verboseDebug(
            apiClientName,
            `Retrying request (${config.retryCount}) after 3 minutes due to 429 status.`,
          );
          await sleep(180000);
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
      soosLogger.verboseDebug("Handling pagination for ", response.config.url);
      soosLogger.verboseDebug("Next url being fetched for pagination", nextUrl);
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

  async getGithubOrgs(): Promise<GitHubOrganization[]> {
    const response = await this.client.get<GitHubOrganization[]>(`/user/orgs?per_page=100`);

    const orgs: GitHubOrganization[] = response.data;
    return orgs;
  }

  async getGitHubOrgRepos(org: GitHubOrganization): Promise<GitHubRepository[]> {
    const response = await this.client.get<GitHubRepository[]>(
      `/orgs/${org.login}/repos?per_page=50`,
    );

    const repos: GitHubRepository[] = response.data;
    return repos;
  }

  async getContributorsForRepo(repository: GitHubRepository): Promise<ContributingDeveloper[]> {
    const response = await this.client.get<Commits[]>(
      `/repos/${repository.owner.login}/${repository.name}/commits?per_page=100&since=${threeMonthsDate}`,
    );

    const commits: Commits[] = await response.data;

    const contributors = commits.reduce<ContributingDeveloper[]>((acc, commit) => {
      const username = commit.commit.author.name;
      const commitDate = commit.commit.author.date;

      const repo = {
        id: repository.id,
        name: repository.name,
        lastCommit: commitDate,
        isPrivate: repository.private,
      };

      let existingContributor = acc.find((contributor) => contributor.username === username);

      if (!existingContributor) {
        existingContributor = { username, repositories: [repo] };
        acc.push(existingContributor);
      } else {
        const existingRepository = existingContributor.repositories.find((r) => r.id === repo.id);
        if (!existingRepository) {
          existingContributor.repositories.push(repo);
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
