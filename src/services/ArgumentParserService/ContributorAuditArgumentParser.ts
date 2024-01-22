import { ArgumentParser } from "argparse";
import { ScanType, ScmType } from "../../enums";
import { SOOS_CONTRIBUTOR_AUDIT_CONSTANTS } from "../ContributorAuditService/constants";
import { ArgumentParserBase, ICommonArguments } from "./ArgumentParserBase";

class ContributorAuditArgumentParser extends ArgumentParserBase {
  public scanType?: ScanType;

  constructor(argumentParser: ArgumentParser, scanType?: ScanType) {
    super(argumentParser);
    this.scanType = scanType;
  }

  static create(
    argumentParser: ArgumentParser,
    scanType?: ScanType,
  ): ContributorAuditArgumentParser {
    return new ContributorAuditArgumentParser(argumentParser, scanType);
  }

  addSpecificArguments() {
    this.argumentParser.add_argument("--days", {
      help: "Number of days to look back for commits.",
      default: SOOS_CONTRIBUTOR_AUDIT_CONSTANTS.Parameters.DefaultDaysAgo,
      required: false,
      type: Number,
    });

    this.argumentParser.add_argument("--secret", {
      help: "Secret to use for api calls, for example when --scmType=GitHub this needs to have the value of a GPAT.",
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
      help: "Scm Type to use for the audit. Options: GitHub.",
      default: ScmType.GitHub,
      required: false,
    });

    this.argumentParser.add_argument("--organizationName", {
      help: "Organization name to use for the audit.",
      default: false,
      required: false,
    });
  }
}

export default ContributorAuditArgumentParser;

export { ICommonArguments };
