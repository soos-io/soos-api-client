import GitHubApiClient, { GitHubOrganization } from "./api/GitHubApiClient";

class GitHubService {
  private readonly client: GitHubApiClient;

  constructor(githubPAT: string, baseUri: string = "https://api.github.com") {
    this.client = new GitHubApiClient(githubPAT, baseUri);
  }

  async getGitHubOrgs(): Promise<GitHubOrganization[]> {
    const organizations = await this.client.getGithubOrgs();
    return organizations;
  }
}

export default GitHubService;
