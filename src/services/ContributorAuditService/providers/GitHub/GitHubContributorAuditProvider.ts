import {
  IContributorAuditModel,
  IContributorAuditRepositories,
} from "../../../../api/SOOSHooksApiClient";
import { soosLogger } from "../../../../logging";
import { IContributorAuditProvider } from "../../ContributorAuditService";
import { ParamUtilities } from "../../utilities";
import GitHubApiClient, { GitHubRepository } from "./GitHubApiClient";
import { SOOS_GITHUB_CONTRIBUTOR_AUDIT_CONSTANTS } from "./constants";
import { mergeContributors } from "./utilities";

class GitHubContributorAuditProvider implements IContributorAuditProvider {
  public async audit(
    implementationParams: Record<string, string | number>,
  ): Promise<IContributorAuditModel> {
    const gitHubPAT = ParamUtilities.getAsString(implementationParams, "secret");
    const organizationName = ParamUtilities.getAsString(implementationParams, "organizationName");
    const days = ParamUtilities.getAsNumber(implementationParams, "days");
    const gitHubApiClient = new GitHubApiClient(days, gitHubPAT, organizationName);
    const organizations = await gitHubApiClient.getGitHubOrganizations();
    soosLogger.verboseDebug("Fetching GitHub repositories");
    const repositories = await Promise.all(
      organizations.map((org) => gitHubApiClient.getGitHubOrganizationRepositories(org)),
    );

    soosLogger.verboseDebug("Fetching commits for each repository");
    const contributors = await this.getGitHubRepositoryContributors(
      gitHubApiClient,
      repositories.flatMap((repoArray) => {
        return repoArray;
      }),
      SOOS_GITHUB_CONTRIBUTOR_AUDIT_CONSTANTS.RequestBatchSize,
    );

    const scriptVersion = ParamUtilities.getAsString(implementationParams, "scriptVersion");

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
        `A GitHub personal access token (PAT) is required as the '--secret', learn more at ${SOOS_GITHUB_CONTRIBUTOR_AUDIT_CONSTANTS.Urls.Docs.PAT}`,
      );
    }
  }

  private async getGitHubRepositoryContributors(
    gitHubApiClient: GitHubApiClient,
    repositories: GitHubRepository[],
    batchSize: number,
  ): Promise<IContributorAuditRepositories[]> {
    const contributorsArray: IContributorAuditRepositories[][] = [];

    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((repo) => gitHubApiClient.getGitHubRepositoryContributors(repo)),
      );
      contributorsArray.push(...results);
    }

    return mergeContributors(contributorsArray);
  }
}

export default GitHubContributorAuditProvider;
