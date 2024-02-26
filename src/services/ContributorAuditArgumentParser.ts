import { ArgumentParser } from "argparse";
import { ScmType } from "../enums";
import { SOOS_CONTRIBUTOR_AUDIT_CONSTANTS } from "./ContributorAuditService/constants";
import { ArgumentParserBase, ICommonArguments } from "./ArgumentParserBase";

interface IContributorAuditArguments extends ICommonArguments {
  days: number;
  secret: string;
  saveResults: boolean;
  scmType: ScmType;
  organizationName: string;
  userName: string;
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

    this.argumentParser.add_argument("--organizationName", {
      help: "Organization name to use for the audit.",
      default: false,
      required: false,
    });

    this.argumentParser.add_argument("--secret", {
      help: "Secret to use for api calls, for example for GitHub this needs to have the value of a GPAT and for Bitbucket it should be an app password.",
      default: false,
      required: false,
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

    this.argumentParser.add_argument("--userName", {
      help: "Username for Bitbucket audit.",
      default: false,
      required: false,
    });
  }
}

export default ContributorAuditArgumentParser;

export { IContributorAuditArguments };
