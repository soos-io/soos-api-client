import {
  IContributorAuditModel,
  IContributorAuditRepositories,
} from "../../../../api/SOOSHooksApiClient";
import { soosLogger } from "../../../../logging";
import { IContributorAuditProvider } from "../../ContributingDeveloperAuditService";
import { ParamUtilities } from "../../utilities";
import GitHubApiClient, { GitHubRepository } from "./api/GitHubApiClient";
import { SOOS_CONTRIBUTOR_GITHUB_CONSTANTS } from "./constants";
import { mergeContributors } from "./utilities";

class GitHubAuditProvider implements IContributorAuditProvider {
  public async audit(
    implementationParams: Record<string, string | number>,
  ): Promise<IContributorAuditModel> {
    const githubPAT = ParamUtilities.getParamAsString(implementationParams, "secret");
    const organizationName = ParamUtilities.getParamAsString(
      implementationParams,
      "organizationName",
    );
    const days = ParamUtilities.getParamAsNumber(implementationParams, "days");
    const githubApiClient = new GitHubApiClient(days, githubPAT, organizationName);
    const organizations = await githubApiClient.getGithubOrgs();
    soosLogger.verboseDebug("Fetching GitHub repositories");
    const repositories = await Promise.all(
      organizations.map((org) => githubApiClient.getGitHubOrgRepos(org)),
    );

    soosLogger.verboseDebug("Fetching commits for each repository");
    const contributors = await this.processInBatches(
      githubApiClient,
      repositories.flatMap((repoArray) => {
        return repoArray;
      }),
      10,
    );

    const scriptVersion = ParamUtilities.getParamAsString(implementationParams, "scriptVersion");

    const finalContributors: IContributorAuditModel = {
      metadata: {
        scriptVersion: scriptVersion,
        days: days,
      },
      organizationName: organizationName,
      contributors: contributors,
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

  private async processInBatches(
    githubApiClient: GitHubApiClient,
    repositories: GitHubRepository[],
    batchSize: number,
  ): Promise<IContributorAuditRepositories[]> {
    const contributorsArray: IContributorAuditRepositories[][] = [];

    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((repo) => githubApiClient.getContributorsForRepo(repo)),
      );
      contributorsArray.push(...results);
    }

    return mergeContributors(contributorsArray);
  }
}

export default GitHubAuditProvider;
