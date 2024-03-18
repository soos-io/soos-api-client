import { ArgumentParser } from "argparse";
import { ScmResultsFormat, ScmType } from "../enums";
import { SOOS_CONTRIBUTOR_AUDIT_CONSTANTS } from "./ContributorAuditService/constants";
import { ArgumentParserBase, ICommonArguments } from "./ArgumentParserBase";
import GitHubContributorAuditProvider from "./ContributorAuditService/providers/GitHub/GitHubContributorAuditProvider";
import BitbucketCloudContributorAuditProvider from "./ContributorAuditService/providers/BitbucketCloud/BitbucketCloudContributorAuditProvider";

interface IContributorAuditArguments extends ICommonArguments {
  days: number;
  secret: string;
  saveResults: ScmResultsFormat;
  scmType: ScmType;
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

    this.addEnumArgument(this.argumentParser, "--saveResults", ScmResultsFormat, {
      help: "Save results to file, options available: JSON, TXT.",
      required: false,
    });

    this.addEnumArgument(this.argumentParser, "--scmType", ScmType, {
      help: "Scm Type to use for the audit. Options: GitHub, Bitbucket.",
      default: ScmType.GitHub,
      required: false,
    });
  }

  parseArguments() {
    this.addCommonArguments();
    this.addBaseContributorArguments();
    const args = this.argumentParser.parse_known_args()[0] as IContributorAuditArguments;

    switch (args.scmType) {
      case ScmType.GitHub: {
        return GitHubContributorAuditProvider.parseArgs(this.argumentParser);
      }
      case ScmType.BitbucketCloud: {
        return BitbucketCloudContributorAuditProvider.parseArgs(this.argumentParser);
      }
      default:
        throw new Error("Invalid scmType");
    }
  }
}

export default ContributorAuditArgumentParser;

export { IContributorAuditArguments };
