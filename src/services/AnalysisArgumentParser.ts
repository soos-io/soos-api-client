import { ArgumentParser } from "argparse";
import {
  ContributingDeveloperSource,
  IntegrationName,
  IntegrationType,
  LogLevel,
  ScanType,
} from "../enums";
import { SOOS_CONSTANTS } from "../constants";
import { ensureEnumValue, ensureNonEmptyValue, getEnvVariable } from "../utilities";

const getIntegrateUrl = (scanType: ScanType) =>
  `${SOOS_CONSTANTS.Urls.App.Home}integrate/${
    scanType == ScanType.CSA ? "containers" : scanType.toLowerCase()
  }`;

class AnalysisArgumentParser {
  public scanType: ScanType;
  public scriptVersion: string;
  public argumentParser: ArgumentParser;

  constructor(scanType: ScanType, scriptVersion: string, argumentParser: ArgumentParser) {
    this.scanType = scanType;
    this.scriptVersion = scriptVersion;
    this.argumentParser = argumentParser;
  }

  static create(scanType: ScanType, scriptVersion: string): AnalysisArgumentParser {
    const parser = new ArgumentParser({ description: `SOOS ${scanType}` });
    return new AnalysisArgumentParser(scanType, scriptVersion, parser);
  }

  addBaseScanArguments() {
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

    this.argumentParser.add_argument("--clientId", {
      help: `SOOS Client ID - get yours from ${getIntegrateUrl(this.scanType)}`,
      default: getEnvVariable(SOOS_CONSTANTS.EnvironmentVariables.ClientId),
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

    this.argumentParser.add_argument("--contributingDeveloperSource", {
      help: "Contributing Developer Source - Intended for internal use only.",
      required: false,
      type: (value: string) => {
        return ensureEnumValue(ContributingDeveloperSource, value);
      },
      default: ContributingDeveloperSource.Unknown,
    });

    this.argumentParser.add_argument("--contributingDeveloperSourceName", {
      help: "Contributing Developer Source Name - Intended for internal use only.",
      required: false,
    });

    this.argumentParser.add_argument("--integrationName", {
      help: "Integration Name - Intended for internal use only.",
      required: false,
      type: (value: string) => {
        return ensureEnumValue(IntegrationName, value);
      },
      default: IntegrationName.SoosSca,
    });

    this.argumentParser.add_argument("--integrationType", {
      help: "Integration Type - Intended for internal use only.",
      required: false,
      type: (value: string) => {
        return ensureEnumValue(IntegrationType, value);
      },
      default: IntegrationType.Script,
    });

    this.argumentParser.add_argument("--logLevel", {
      help: "Minimum level to show logs: PASS, IGNORE, INFO, WARN or FAIL.",
      default: LogLevel.INFO,
      required: false,
      type: (value: string) => {
        return ensureEnumValue(LogLevel, value);
      },
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

    this.argumentParser.add_argument("--scriptVersion", {
      help: "Script Version - Intended for internal use only.",
      required: false,
      default: this.scriptVersion,
    });

    this.argumentParser.add_argument("--verbose", {
      help: "Enable verbose logging.",
      action: "store_true",
      default: false,
      required: false,
    });
  }
}

export default AnalysisArgumentParser;
