import {
  IContributorAuditModel,
  IContributorAuditRepositories,
} from "../../../../api/SOOSHooksApiClient";
import { soosLogger } from "../../../../logging";
import { IContributorAuditProvider } from "../../ContributorAuditService";
import { DataMappingUtilities, ParamUtilities } from "../../utilities";
import BitbucketCloudApiClient, { BitbucketCloudRepository } from "./BitbucketCloudApiClient";
import { SOOS_BITBUCKET_CLOUD_CONTRIBUTOR_AUDIT_CONSTANTS } from "./constants";

class BitbucketCloudContributorAuditProvider implements IContributorAuditProvider {
  public async audit(
    implementationParams: Record<string, string | number>,
  ): Promise<IContributorAuditModel> {
    const bitbucketPAT = ParamUtilities.getAsString(implementationParams, "secret");
    const organizationName = ParamUtilities.getAsString(implementationParams, "organizationName");
    const days = ParamUtilities.getAsNumber(implementationParams, "days");
    const userName = ParamUtilities.getAsString(implementationParams, "userName");
    const bitbucketApiClient = new BitbucketCloudApiClient(
      days,
      userName,
      bitbucketPAT,
      organizationName,
    );
    const repositories = await bitbucketApiClient.getBitbucketCloudRepositories();
    soosLogger.verboseDebug("Fetching commits for each repository");
    const contributors = await this.getBitbucketCloudRepositoryContributors(
      bitbucketApiClient,
      repositories,
      SOOS_BITBUCKET_CLOUD_CONTRIBUTOR_AUDIT_CONSTANTS.RequestBatchSize,
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
        `A BitbucketCloud App passsword is required as the '--secret', learn more at ${SOOS_BITBUCKET_CLOUD_CONTRIBUTOR_AUDIT_CONSTANTS.Urls.Docs.AppPassword}`,
      );
    }
    if (!implementationParams["userName"]) {
      throw new Error(`A BitbucketCloud username is required as the '--userName'`);
    }
  }

  private async getBitbucketCloudRepositoryContributors(
    bitbucketApiClient: BitbucketCloudApiClient,
    repositories: BitbucketCloudRepository[],
    batchSize: number,
  ): Promise<IContributorAuditRepositories[]> {
    const contributorsArray: IContributorAuditRepositories[][] = [];

    for (let i = 0; i < repositories.length; i += batchSize) {
      const batch = repositories.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((repo) => bitbucketApiClient.getBitbucketCloudRepositoryContributors(repo)),
      );
      contributorsArray.push(...results);
    }

    return DataMappingUtilities.mergeContributors(contributorsArray);
  }
}

export default BitbucketCloudContributorAuditProvider;
