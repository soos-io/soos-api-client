import { sleep } from "../../../../utilities";
import { IContributingDeveloperAudit } from "../../ContributingDeveloperAuditService";
import GitHubService from "./GitHubService";
import { ContributingDeveloper } from "./api/GitHubApiClient";

class GitHubAudit implements IContributingDeveloperAudit {
  public async audit(implementationParams: string[]): Promise<ContributingDeveloper[]> {
    const githubService = new GitHubService(implementationParams[0]);
    const organizations = await githubService.getGitHubOrgs();
    const repositories = await Promise.all(
      organizations.map((org) => githubService.getGitHubOrgRepos(org)),
    );
    const contributors = await Promise.all(
      repositories.flatMap((repoArray) =>
        repoArray.map(async (repo) => {
          await sleep(1000); // TODO - AXIOS INTERCEPTOR
          const contributors = await githubService.getContributorsForRepo(repo);
          return contributors;
        }),
      ),
    );
    return contributors.flat();
  }
}

export default GitHubAudit;
