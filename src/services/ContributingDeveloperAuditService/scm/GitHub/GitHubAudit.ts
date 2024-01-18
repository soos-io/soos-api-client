import { soosLogger } from "../../../../logging";
import { IContributingDeveloperAuditProvider } from "../../ContributingDeveloperAuditService";
import { ParamUtilities } from "../../utilities";
import GitHubService from "./GitHubService";
import { ContributingDeveloper } from "./api/GitHubApiClient";
import { mergeContributors } from "./utilities";

class GitHubAudit implements IContributingDeveloperAuditProvider {
  public async audit(
    implementationParams: Record<string, string | number>,
  ): Promise<ContributingDeveloper> {
    const githubPAT = ParamUtilities.getParamAsString(implementationParams, "secret");
    const organizationName = ParamUtilities.getParamAsString(
      implementationParams,
      "organizationName",
    );
    const days = ParamUtilities.getParamAsNumber(implementationParams, "days");
    const githubService = new GitHubService(days, githubPAT, organizationName);
    const organizations = await githubService.getGitHubOrgs();
    soosLogger.verboseDebug("Fetching GitHub repositories");
    const repositories = await Promise.all(
      organizations.map((org) => githubService.getGitHubOrgRepos(org)),
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

    const scriptVersion = ParamUtilities.getParamAsString(implementationParams, "scriptVersion");

    const finalContributors: ContributingDeveloper = {
      metadata: {
        scriptVersion: scriptVersion,
        days: days,
      },
      organizationName: organizationName,
      repositories: mergeContributors(contributors),
    };

    return finalContributors;
  }

  public validateParams(implementationParams: Record<string, string | number>): void {
    if (!implementationParams["secret"]) {
      throw new Error("GitHub token is required");
    }
    if (!implementationParams["organizationName"]) {
      throw new Error("Organization name is required");
    }
    if (!implementationParams["days"]) {
      throw new Error("Days is required");
    }
    if (ParamUtilities.getParamAsNumber(implementationParams, "days") < 0) {
      throw new Error("Days must be greater than 0");
    }
  }
}

export default GitHubAudit;
