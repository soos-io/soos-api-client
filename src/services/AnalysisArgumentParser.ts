import { ArgumentParser } from "argparse";
import {
  ContributingDeveloperSource,
  IntegrationName,
  IntegrationType,
  LogLevel,
  OnFailure,
  ScanType,
  ScmType,
} from "../enums";
import { SOOS_CONSTANTS } from "../constants";
import { ensureEnumValue, ensureNonEmptyValue, getEnvVariable } from "../utilities";

const getIntegrateUrl = (scanType: ScanType) =>
  `${SOOS_CONSTANTS.Urls.App.Home}integrate/${
    scanType == ScanType.CSA ? "containers" : scanType.toLowerCase()
  }`;

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

interface ICommonArguments {
  apiKey: string;
  apiURL: string;
  clientId: string;
  logLevel: LogLevel;
  scriptVersion: string;
  verbose: boolean;
}

class AnalysisArgumentParser {
  public scanType: ScanType;
  public argumentParser: ArgumentParser;

  constructor(scanType: ScanType, argumentParser: ArgumentParser) {
    this.scanType = scanType;
    this.argumentParser = argumentParser;
  }

  static create(scanType: ScanType): AnalysisArgumentParser {
    const parser = new ArgumentParser({ description: `SOOS ${scanType}` });
    return new AnalysisArgumentParser(scanType, parser);
  }

  addBaseScanArguments(
    integrationName: IntegrationName,
    integrationType: IntegrationType,
    scriptVersion: string,
  ) {
    this.addCommonArguments(scriptVersion);

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

    this.addEnumArgument(this.argumentParser, "--integrationName", IntegrationName, {
      help: "Integration Name - Intended for internal use only.",
      required: false,
      default: integrationName,
    });

    this.addEnumArgument(this.argumentParser, "--integrationType", IntegrationType, {
      help: "Integration Type - Intended for internal use only.",
      required: false,
      default: integrationType,
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

  addCommonArguments(scriptVersion: string) {
    this.argumentParser.add_argument("--apiKey", {
      help: `SOOS API Key - get yours from ${getIntegrateUrl(this.scanType)}`,
      default: getEnvVariable(SOOS_CONSTANTS.EnvironmentVariables.ApiKey),
      required: false,
    });

    this.argumentParser.add_argument("--apiURL", {
      help: "SOOS API URL - Intended for internal use only, do not modify.",
      default: SOOS_CONSTANTS.Urls.API.Analysis,
      required: false,
      type: (value: string) => {
        return ensureNonEmptyValue(value, "apiURL");
      },
    });

    this.argumentParser.add_argument("--clientId", {
      help: `SOOS Client ID - get yours from ${getIntegrateUrl(this.scanType)}`,
      default: getEnvVariable(SOOS_CONSTANTS.EnvironmentVariables.ClientId),
      required: false,
    });

    this.addEnumArgument(this.argumentParser, "--logLevel", LogLevel, {
      help: "Minimum level to show logs: PASS, IGNORE, INFO, WARN or FAIL.",
      default: LogLevel.INFO,
      required: false,
    });

    this.argumentParser.add_argument("--scriptVersion", {
      help: "Script Version - Intended for internal use only.",
      required: false,
      default: scriptVersion,
    });

    this.argumentParser.add_argument("--verbose", {
      help: "Enable verbose logging.",
      action: "store_true",
      default: false,
      required: false,
    });
  }

  addSCMAuditArguments(scriptVersion: string) {
    this.addCommonArguments(scriptVersion);

    this.argumentParser.add_argument("--githubPAT", {
      help: "GitHub Personal Access token, used when --scmType=GitHub.",
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
  }

  addEnumArgument(
    parser: ArgumentParser,
    argName: string,
    enumObject: Record<string, unknown>,
    options = {},
    allowMultipleValues = false,
  ) {
    parser.add_argument(argName, {
      ...options,
      type: (value: string) => {
        if (allowMultipleValues) {
          return value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v !== "")
            .map((v) => ensureEnumValue(enumObject, v, argName));
        }

        return ensureEnumValue(enumObject, value, argName);
      },
    });
  }

  parseArguments() {
    const args = this.argumentParser.parse_args();
    this.ensureRequiredArguments(args);
    return args;
  }

  ensureRequiredArguments(args: any) {
    ensureNonEmptyValue(args.clientId, "clientId");
    ensureNonEmptyValue(args.apiKey, "apiKey");
    if (args.projectName) ensureNonEmptyValue(args.projectName, "projectName");
  }
}

export default AnalysisArgumentParser;

export { IBaseScanArguments, ICommonArguments };
