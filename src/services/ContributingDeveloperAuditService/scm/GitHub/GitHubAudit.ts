import { soosLogger } from "../../../../logging";
import { IContributingDeveloperAudit } from "../../ContributingDeveloperAuditService";
import GitHubService from "./GitHubService";
import { ContributingDeveloper } from "./api/GitHubApiClient";
import { mergeContributors } from "./utilities";

class GitHubAudit implements IContributingDeveloperAudit {
  public async audit(
    implementationParams: Record<string, string>,
  ): Promise<ContributingDeveloper[]> {
    const githubPAT = implementationParams["githubPAT"];
    if (!githubPAT) {
      throw new Error("GitHub token is required");
    }
    const githubService = new GitHubService(githubPAT);
    const organizations = await githubService.getGitHubOrgs();
    soosLogger.verboseDebug("Fetching GitHub repositories");
    const repositories = await Promise.all(
      organizations
        .filter((org) => org.login === "soos-io") // TODO - REMOVE THIS FILTER ONLY FOR TESTING
        .map((org) => githubService.getGitHubOrgRepos(org)),
    );

    soosLogger.verboseDebug("Fetching commits for each repository");
    const contributors = await Promise.all(
      repositories.flatMap((repoArray) =>
        repoArray.map(async (repo) => {
          const contributors = await githubService.getContributorsForRepo(repo);
          return contributors;
        }),
      ),
    );

    return mergeContributors(contributors);
  }
}

export default GitHubAudit;
