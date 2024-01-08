import { ScmType } from "../../enums";
import GitHubAudit from "./scm/GitHub/GitHubAudit";

export interface IContributingDeveloperAudit {
  audit(implementationParams: string[]): Promise<any>;
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

  public async audit(implementationParams: string[]) {
    return this.scmImplementation.audit(implementationParams);
  }
}

export default ContributingDeveloperAuditService;
