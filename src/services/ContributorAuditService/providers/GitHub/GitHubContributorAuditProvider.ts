import { ArgumentParser } from "argparse";
import {
  IContributorAuditModel,
  IContributorAuditRepositories,
} from "../../../../api/SOOSHooksApiClient";
import { soosLogger } from "../../../../logging";
import { IContributorAuditProvider } from "../../ContributorAuditService";
import { DataMappingUtilities, ParamUtilities } from "../../utilities";
import GitHubApiClient, { GitHubRepository } from "./GitHubApiClient";
import { SOOS_GITHUB_CONTRIBUTOR_AUDIT_CONSTANTS } from "./constants";
import { IContributorAuditArguments } from "../../../ContributorAuditArgumentParser";

interface IGitHubContributorAuditArguments extends IContributorAuditArguments {
  organizationName: string;
}

class GitHubContributorAuditProvider implements IContributorAuditProvider {
  public async audit(
    implementationParams: Record<string, string | number>,
  ): Promise<IContributorAuditModel> {
    const gitHubPAT = ParamUtilities.getAsString(implementationParams, "secret");
    const organizationName = ParamUtilities.getAsString(implementationParams, "organizationName");
    const days = ParamUtilities.getAsNumber(implementationParams, "days");
    const gitHubApiClient = new GitHubApiClient(days, gitHubPAT, organizationName);
    const organizations = await gitHubApiClient.getGitHubOrganizations();
    soosLogger.debug("Fetching GitHub repositories");
    const repositories = await Promise.all(
      organizations.map((org) => gitHubApiClient.getGitHubOrganizationRepositories(org)),
    );

    soosLogger.debug("Fetching commits for each repository");
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

  public static addProviderArgs(argumentParser: ArgumentParser): void {
    argumentParser.add_argument("--organizationName", {
      help: "Organization name to use for the audit.",
      default: false,
      required: true,
    });

    argumentParser.add_argument("--secret", {
      help: "Secret to use for api calls, it should be a GPAT.",
      default: false,
      required: true,
    });
  }

  public static parseArgs(argumentParser: ArgumentParser): IGitHubContributorAuditArguments {
    this.addProviderArgs(argumentParser);
    return argumentParser.parse_args() as IGitHubContributorAuditArguments;
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

    return DataMappingUtilities.mergeContributors(contributorsArray);
  }
}

export default GitHubContributorAuditProvider;

export { IGitHubContributorAuditArguments };
