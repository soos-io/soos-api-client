import { IContributorAuditModel } from "../../api/SOOSHooksApiClient";
import { SOOS_CONSTANTS } from "../../constants";
import { ScmType } from "../../enums";
import { soosLogger } from "../../logging";
import GitHubAudit from "./scm/GitHub/GitHubAudit";
import FileSystem from "fs";
import * as Path from "path";

export interface IContributingDeveloperAuditProvider {
  audit(implementationParams: Record<string, string | number>): Promise<IContributorAuditModel>;
  validateParams(implementationParams: Record<string, string | number>): void;
}

class ContributingDeveloperAuditService {
  private auditProvider: IContributingDeveloperAuditProvider;

  constructor(scmType: ScmType) {
    if (scmType === ScmType.GitHub) {
      this.auditProvider = new GitHubAudit();
    } else {
      throw new Error("Unsupported SCM type");
    }
  }

  public async audit(implementationParams: Record<string, string | number>) {
    this.auditProvider.validateParams(implementationParams);
    return this.auditProvider.audit(implementationParams);
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
}

export default ContributingDeveloperAuditService;
