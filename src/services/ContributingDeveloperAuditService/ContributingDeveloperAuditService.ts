import { ScmType } from "../../enums";
import GitHubAudit from "./scm/GitHub/GitHubAudit";
import { ContributingDeveloper } from "./scm/GitHub/api";

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
}

export default ContributingDeveloperAuditService;
