import SOOSHooksApiClient, { IContributorAuditModel } from "../../api/SOOSHooksApiClient";
import { SOOS_CONSTANTS } from "../../constants";
import { ScmType } from "../../enums";
import { soosLogger } from "../../logging";
import GitHubAudit from "./scm/GitHub/GitHubAudit";
import FileSystem from "fs";
import * as Path from "path";
import { ParamUtilities } from "./utilities";

export interface IContributingDeveloperAuditProvider {
  audit(implementationParams: Record<string, string | number>): Promise<IContributorAuditModel>;
  validateParams(implementationParams: Record<string, string | number>): void;
}

class ContributingDeveloperAuditService {
  private auditProvider: IContributingDeveloperAuditProvider;
  public soosHooksApiClient: SOOSHooksApiClient;

  constructor(
    auditProvider: IContributingDeveloperAuditProvider,
    hooksApiClient: SOOSHooksApiClient,
  ) {
    this.auditProvider = auditProvider;
    this.soosHooksApiClient = hooksApiClient;
  }

  static create(
    apiKey: string,
    apiURL: string,
    scmType: ScmType,
  ): ContributingDeveloperAuditService {
    let auditProvider: IContributingDeveloperAuditProvider;

    if (scmType === ScmType.GitHub) {
      auditProvider = new GitHubAudit();
    } else {
      throw new Error("Unsupported SCM type");
    }

    const hooksApiClient = new SOOSHooksApiClient(apiKey, apiURL.replace("api.", "api-hooks."));

    return new ContributingDeveloperAuditService(auditProvider, hooksApiClient);
  }

  public async audit(implementationParams: Record<string, string | number>) {
    this.validateCommonParams(implementationParams);
    this.auditProvider.validateParams(implementationParams);
    return this.auditProvider.audit(implementationParams);
  }

  public async uploadContributorAudits(
    clientHash: string,
    contributorAudit: IContributorAuditModel,
  ): Promise<void> {
    soosLogger.info(`Uploading Contributor Audit.`);
    await this.soosHooksApiClient.postContributorAudits(clientHash, contributorAudit);
    soosLogger.info(`Results uploaded successfully.`);
  }

  public async saveResults(results: IContributorAuditModel) {
    soosLogger.info(`Saving results.`);
    FileSystem.writeFileSync(
      Path.join(process.cwd(), SOOS_CONSTANTS.Files.ContributingDevelopersOutput),
      JSON.stringify(results, null, 2),
    );
    soosLogger.info(
      `Results saved successfully ${process.cwd()}/${
        SOOS_CONSTANTS.Files.ContributingDevelopersOutput
      }`,
    );
  }

  private validateCommonParams(implementationParams: Record<string, string | number>) {
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

export default ContributingDeveloperAuditService;
