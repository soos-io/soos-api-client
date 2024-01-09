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
}

const d = new Date();
d.setDate(d.getDate() - 90);
export const threeMonthsDate = `${d.getUTCFullYear()}-${
  d.getMonth() + 1
}-${d.getUTCDate()}T${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}Z`;

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

    const orgs: GitHubOrganization[] = response.data;
    return orgs;
  }

  async getGitHubOrgRepos(org: GitHubOrganization): Promise<GitHubRepository[]> {
    const response = await this.client.get<GitHubRepository[]>(
      `/orgs/${org.login}/repos?per_page=1`,
    );

    const repos: GitHubRepository[] = response.data;
    return repos;
  }

  async getContributorsForRepo(repository: GitHubRepository): Promise<ContributingDeveloper[]> {
    const response = await this.client.get<Commits[]>(
      `/repos/${repository.owner.login}/${repository.name}/commits?per_page=100&since=${threeMonthsDate}`,
    );

    const commits: Commits[] = await response.data;

    const contributors: ContributingDeveloper[] = [];
    commits.forEach((commit) => {
      const username = commit.commit.author;
      const repo = {
        id: repository.id,
        name: repository.name,
        lastCommit: threeMonthsDate, // TODO - get the last commit date
        isPrivate: repository.private,
      };
      const existingContributor = contributors.find(
        (contributor) => contributor.username === username.name,
      );
      // TODO - do this more performant
      if (existingContributor) {
        existingContributor.repositories.forEach((existingRepo) => {
          if (existingRepo.id === repo.id) {
            return;
          } else {
            existingContributor.repositories.push(repo);
          }
        });
      } else {
        contributors.push({
          username: username.name,
          repositories: [repo],
        });
      }
    });

    return contributors;
  }
}

export default GitHubApiClient;
