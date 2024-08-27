import SOOSHooksApiClient, { IContributorAuditModel } from "../../api/SOOSHooksApiClient";
import { SOOS_CONSTANTS } from "../../constants";
import { ScmResultsFormat, ScmType } from "../../enums";
import { soosLogger } from "../../logging";
import FileSystem from "fs";
import * as Path from "path";
import { ParamUtilities } from "./utilities";
import GitHubContributorAuditProvider from "./providers/GitHub/GitHubContributorAuditProvider";
import BitbucketContributorAuditProvider from "./providers/BitbucketCloud/BitbucketCloudContributorAuditProvider";

export interface IContributorAuditProvider {
  audit(implementationParams: Record<string, string | number>): Promise<IContributorAuditModel>;
}

class ContributorAuditService {
  private auditProvider: IContributorAuditProvider;
  public hooksApiClient: SOOSHooksApiClient;

  constructor(auditProvider: IContributorAuditProvider, hooksApiClient: SOOSHooksApiClient) {
    this.auditProvider = auditProvider;
    this.hooksApiClient = hooksApiClient;
  }

  static create(apiKey: string, apiURL: string, scmType: ScmType): ContributorAuditService {
    let auditProvider: IContributorAuditProvider;

    switch (scmType) {
      case ScmType.GitHub: {
        auditProvider = new GitHubContributorAuditProvider();
        break;
      }
      case ScmType.BitbucketCloud: {
        auditProvider = new BitbucketContributorAuditProvider();
        break;
      }
      default: {
        throw new Error(`Unsupported SCM type: ${scmType}`);
      }
    }

    const hooksApiClient = new SOOSHooksApiClient(apiKey, apiURL.replace("api.", "api-hooks."));

    return new ContributorAuditService(auditProvider, hooksApiClient);
  }

  public async audit(implementationParams: Record<string, string | number>) {
    this.validateCommonParams(implementationParams);
    const contributors = await this.auditProvider.audit(implementationParams);
    soosLogger.debug(`Contributing Developers found: ${JSON.stringify(contributors, null, 2)}`);
    return contributors;
  }

  public async uploadContributorAudits(
    clientHash: string,
    contributorAudit: IContributorAuditModel,
  ): Promise<void> {
    soosLogger.info(`Uploading Contributor Audit to SOOS.`);
    await this.hooksApiClient.postContributorAudits(clientHash, contributorAudit);
    soosLogger.info(`Results uploaded successfully.`);
  }

  public async saveResults(results: IContributorAuditModel, format: ScmResultsFormat) {
    soosLogger.info(`Saving results.`);
    switch (format) {
      case ScmResultsFormat.JSON: {
        await this.saveResultsAsJSON(results);
        break;
      }
      case ScmResultsFormat.TXT: {
        await this.saveResultsAsTXT(results);
        break;
      }
      default: {
        throw new Error(`Unsupported format: ${format}`);
      }
    }
  }

  private async saveResultsAsJSON(results: IContributorAuditModel) {
    FileSystem.writeFileSync(
      Path.join(process.cwd(), `${SOOS_CONSTANTS.Files.ContributorAuditResults}.json`),
      JSON.stringify(results, null, 2),
    );
    soosLogger.info(
      `Results saved successfully ${Path.join(
        process.cwd(),
        `${SOOS_CONSTANTS.Files.ContributorAuditResults}.json`,
      )}`,
    );
  }

  private async saveResultsAsTXT(results: IContributorAuditModel) {
    const uniqueContributors = new Set<string>();
    results.contributors
      .sort((a, b) => a.username.localeCompare(b.username))
      .forEach((contributor) => {
        uniqueContributors.add(contributor.username);
      });

    FileSystem.writeFileSync(
      Path.join(process.cwd(), `${SOOS_CONSTANTS.Files.ContributorAuditResults}.txt`),
      Array.from(uniqueContributors).join("\n"),
    );
    soosLogger.info(
      `Results saved successfully ${Path.join(
        process.cwd(),
        `${SOOS_CONSTANTS.Files.ContributorAuditResults}.txt`,
      )}`,
    );
  }

  private validateCommonParams(implementationParams: Record<string, string | number>) {
    if (!implementationParams["days"]) {
      throw new Error("Days is required");
    }
    if (ParamUtilities.getAsNumber(implementationParams, "days") < 0) {
      throw new Error("Days must be greater than 0");
    }
  }
}

export default ContributorAuditService;
