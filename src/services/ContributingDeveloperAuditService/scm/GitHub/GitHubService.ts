import GitHubApiClient, {
  ContributingDeveloper,
  GitHubOrganization,
  GitHubRepository,
} from "./api/GitHubApiClient";

class GitHubService {
  private readonly client: GitHubApiClient;

  constructor(githubPAT: string, baseUri: string = "https://api.github.com") {
    this.client = new GitHubApiClient(githubPAT, baseUri);
  }

  async getGitHubOrgs(): Promise<GitHubOrganization[]> {
    const organizations = await this.client.getGithubOrgs();
    return organizations;
  }

  async getGitHubOrgRepos(orgName: GitHubOrganization): Promise<GitHubRepository[]> {
    const repos = await this.client.getGitHubOrgRepos(orgName);
    return repos;
  }

  async getContributorsForRepo(repo: GitHubRepository): Promise<ContributingDeveloper[]> {
    const contributors = await this.client.getContributorsForRepo(repo);
    return contributors;
  }
}

export default GitHubService;
