import { IContributorAuditModel } from "../../../../api/SOOSHooksApiClient";
import { soosLogger } from "../../../../logging";
import { IContributingDeveloperAuditProvider } from "../../ContributingDeveloperAuditService";
import { ParamUtilities } from "../../utilities";
import GitHubService from "./GitHubService";
import { SOOS_CONTRIBUTOR_GITHUB_CONSTANTS } from "./constants";
import { mergeContributors } from "./utilities";

class GitHubAudit implements IContributingDeveloperAuditProvider {
  public async audit(
    implementationParams: Record<string, string | number>,
  ): Promise<IContributorAuditModel> {
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

    const finalContributors: IContributorAuditModel = {
      metadata: {
        scriptVersion: scriptVersion,
        days: days,
      },
      organizationName: organizationName,
      contributors: mergeContributors(contributors),
    };

    return finalContributors;
  }

  public validateParams(implementationParams: Record<string, string | number>): void {
    if (!implementationParams["secret"]) {
      throw new Error(
        `GitHub token is required, learn more at ${SOOS_CONTRIBUTOR_GITHUB_CONSTANTS.Urls.Docs.PAT}`,
      );
    }
  }
}

export default GitHubAudit;
