import { IContributingDeveloperAudit } from "../../ContributingDeveloperAuditService";
import GitHubService from "./GitHubService";
import { GitHubOrganization } from "./api/GitHubApiClient";

class GitHubAudit implements IContributingDeveloperAudit {
  public async audit(implementationParams: string[]): Promise<GitHubOrganization[]> {
    const githubService = new GitHubService(implementationParams[0]);
    const organizations = await githubService.getGitHubOrgs();
    return organizations;
  }
}

export default GitHubAudit;
