import { SOOS_CONSTANTS } from "../../constants";
import { ScmType } from "../../enums";
import { soosLogger } from "../../logging";
import GitHubAudit from "./scm/GitHub/GitHubAudit";
import { ContributingDeveloper } from "./scm/GitHub/api";
import FileSystem from "fs";
import * as Path from "path";

export interface IContributingDeveloperAudit {
  audit(implementationParams: Record<string, string>): Promise<ContributingDeveloper[]>;
}

class ContributingDeveloperAuditService {
  private scmImplementation: IContributingDeveloperAudit;

  constructor(scmType: ScmType) {
    if (scmType === ScmType.GitHub) {
      this.scmImplementation = new GitHubAudit();
    } else {
      throw new Error("Unsupported SCM type");
    }
  }

  public async audit(implementationParams: Record<string, string>) {
    return this.scmImplementation.audit(implementationParams);
  }

  public async saveResults(results: ContributingDeveloper[]) {
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
