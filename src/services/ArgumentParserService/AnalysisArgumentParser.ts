import { ArgumentParser } from "argparse";
import {
  ContributingDeveloperSource,
  IntegrationName,
  IntegrationType,
  OnFailure,
  ScanType,
} from "../../enums";
import { ensureNonEmptyValue } from "../../utilities";
import { ArgumentParserBase, ICommonArguments } from "./ArgumentParserBase";

interface IBaseScanArguments extends ICommonArguments {
  appVersion: string;
  branchName: string;
  branchURI: string;
  buildURI: string;
  buildVersion: string;
  commitHash: string;
  contributingDeveloperId: string;
  contributingDeveloperSource: ContributingDeveloperSource;
  contributingDeveloperSourceName: string;
  integrationName: IntegrationName;
  integrationType: IntegrationType;
  onFailure: OnFailure;
  operatingEnvironment: string;
  projectName: string;
}

class AnalysisArgumentParser extends ArgumentParserBase {
  public scanType?: ScanType;

  constructor(argumentParser: ArgumentParser, scanType?: ScanType) {
    super(argumentParser);
    this.scanType = scanType;
  }

  static create(argumentParser: ArgumentParser, scanType?: ScanType): AnalysisArgumentParser {
    return new AnalysisArgumentParser(argumentParser, scanType);
  }

  addSpecificArguments() {
    this.argumentParser.add_argument("--appVersion", {
      help: "App Version - Intended for internal use only.",
      required: false,
    });

    this.argumentParser.add_argument("--branchName", {
      help: "The name of the branch from the SCM System.",
      required: false,
    });

    this.argumentParser.add_argument("--branchURI", {
      help: "The URI to the branch from the SCM System.",
      required: false,
    });

    this.argumentParser.add_argument("--buildURI", {
      help: "URI to CI build info.",
      required: false,
    });

    this.argumentParser.add_argument("--buildVersion", {
      help: "Version of application build artifacts.",
      required: false,
    });

    this.argumentParser.add_argument("--commitHash", {
      help: "The commit hash value from the SCM System.",
      required: false,
    });

    this.argumentParser.add_argument("--contributingDeveloperId", {
      help: "Contributing Developer ID - Intended for internal use only.",
      required: false,
    });

    this.addEnumArgument(
      this.argumentParser,
      "--contributingDeveloperSource",
      ContributingDeveloperSource,
      {
        help: "Contributing Developer Source - Intended for internal use only.",
        required: false,
        default: ContributingDeveloperSource.Unknown,
      },
    );

    this.argumentParser.add_argument("--contributingDeveloperSourceName", {
      help: "Contributing Developer Source Name - Intended for internal use only.",
      required: false,
    });

    this.addEnumArgument(this.argumentParser, "--onFailure", OnFailure, {
      help: "Action to perform when the scan fails. Options: fail_the_build, continue_on_failure.",
      default: OnFailure.Continue,
      required: false,
    });

    this.argumentParser.add_argument("--operatingEnvironment", {
      help: "Set Operating environment for information purposes only.",
      required: false,
    });

    this.argumentParser.add_argument("--projectName", {
      help: "Project Name - this is what will be displayed in the SOOS app.",
      required: true,
      type: (value: string) => {
        return ensureNonEmptyValue(value, "projectName");
      },
    });
  }
}

export default AnalysisArgumentParser;

export { IBaseScanArguments, ICommonArguments };
