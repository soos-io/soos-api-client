import { ArgumentParser } from "argparse";
import { ScmType } from "../enums";
import { SOOS_CONTRIBUTOR_AUDIT_CONSTANTS } from "./ContributorAuditService/constants";
import { ArgumentParserBase, ICommonArguments } from "./ArgumentParserBase";
import GitHubContributorAuditProvider from "./ContributorAuditService/providers/GitHub/GitHubContributorAuditProvider";
import BitbucketCloudContributorAuditProvider from "./ContributorAuditService/providers/BitbucketCloud/BitbucketCloudContributorAuditProvider";

interface IContributorAuditArguments extends ICommonArguments {
  days: number;
  secret: string;
  saveResults: boolean;
  scmType: ScmType;
  organizationName: string;
  username: string;
  workspace: string;
}

class ContributorAuditArgumentParser extends ArgumentParserBase {
  constructor(argumentParser: ArgumentParser) {
    super(argumentParser);
  }

  static create(): ContributorAuditArgumentParser {
    const parser = new ArgumentParser({ description: `SOOS SCM Audit` });
    return new ContributorAuditArgumentParser(parser);
  }

  addBaseContributorArguments() {
    this.argumentParser.add_argument("--days", {
      help: "Number of days to look back for commits.",
      default: SOOS_CONTRIBUTOR_AUDIT_CONSTANTS.Parameters.DefaultDaysAgo,
      required: false,
      type: Number,
    });

    this.argumentParser.add_argument("--saveResults", {
      help: "Save results to file.",
      action: "store_true",
      default: false,
      required: false,
    });

    this.addEnumArgument(this.argumentParser, "--scmType", ScmType, {
      help: "Scm Type to use for the audit. Options: GitHub, Bitbucket.",
      default: ScmType.GitHub,
      required: false,
    });
  }

  parseArguments(): IContributorAuditArguments {
    this.addCommonArguments();
    this.addBaseContributorArguments();
    const args = this.argumentParser.parse_known_args()[0] as IContributorAuditArguments;

    switch (args.scmType) {
      case ScmType.GitHub: {
        GitHubContributorAuditProvider.addProviderArgs(this.argumentParser);
        break;
      }
      case ScmType.BitbucketCloud: {
        BitbucketCloudContributorAuditProvider.addProviderArgs(this.argumentParser);
        break;
      }
      default:
        throw new Error("Invalid scmType");
    }

    return this.argumentParser.parse_args();
  }
}

export default ContributorAuditArgumentParser;

export { IContributorAuditArguments };
