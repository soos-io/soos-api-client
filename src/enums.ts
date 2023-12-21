export enum ContributingDeveloperSource {
  Unknown = "Unknown",
  GitHubWebhook = "GitHubWebhook",
  EnvironmentVariable = "EnvironmentVariable",
  OperatingSystem = "OperatingSystem",
}

export enum IntegrationName {
  AzureDevOps = "AzureDevOps",
  AWSCodeBuild = "AWSCodeBuild",
  Bamboo = "Bamboo",
  BitBucket = "BitBucket",
  CircleCI = "CircleCI",
  CodeShip = "CodeShip",
  GithubActions = "GitHub",
  GitLab = "GitLab",
  Jenkins = "Jenkins",
  SoosCsa = "SoosCsa",
  SoosDast = "SoosDast",
  SoosSast = "SoosSast",
  SoosSca = "SoosSca",
  SoosSbom = "SoosSbom",
  TeamCity = "TeamCity",
  TravisCI = "TravisCI",
}

export enum IntegrationType {
  None = "None",
  IDE = "IDE",
  Script = "Script",
  Webhook = "Webhook",
  Plugin = "Plugin",
  AppRepo = "AppRepo",
  AppUpload = "AppUpload",
}

export enum PackageManagerType {
  Unknown = "Unknown",
  Alpine = "Alpine",
  CFamily = "CFamily",
  Dart = "Dart",
  Debian = "Debian",
  Docker = "Docker",
  Erlang = "Erlang",
  Fedora = "Fedora",
  Go = "Go",
  Homebrew = "Homebrew",
  Java = "Java",
  NPM = "NPM",
  NuGet = "NuGet",
  Php = "Php",
  Python = "Python",
  Ruby = "Ruby",
  Rust = "Rust",
  Swift = "Swift",
  Wolfi = "Wolfi",
}

export enum ManifestStatus {
  Unknown = "Unknown",
  Valid = "Valid",
  OnlyDevDependencies = "OnlyDevDependencies",
  OnlyLockFiles = "OnlyLockFiles",
  OnlyNonLockFiles = "OnlyNonLockFiles",
  NoPackages = "NoPackages",
  UnknownManifestType = "UnknownManifestType",
  UnsupportedManifestVersion = "UnsupportedManifestVersion",
  ParsingError = "ParsingError",
  Empty = "Empty",
}

export enum ScanStatus {
  Unknown = "Unknown",
  Queued = "Queued",
  Manifest = "Manifest",
  LocatingDependencies = "LocatingDependencies",
  LoadingPackageDetails = "LoadingPackageDetails",
  LocatingVulnerabilities = "LocatingVulnerabilities",
  RunningGovernancePolicies = "RunningGovernancePolicies",
  Finished = "Finished",
  FailedWithIssues = "FailedWithIssues",
  Incomplete = "Incomplete",
  Error = "Error",
}

export enum ScanType {
  CSA = "Csa",
  DAST = "Dast",
  SAST = "Sast",
  SBOM = "Sbom",
  SCA = "Sca",
}

export enum SeverityEnum {
  Unknown = "Unknown",
  None = "None",
  Info = "Info",
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Critical = "Critical",
}

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  FAIL = "FAIL",
  ERROR = "ERROR",
}

export enum OutputFormat {
  SARIF = "SARIF",
}

export enum OnFailure {
  Continue = "continue_on_failure",
  Fail = "fail_the_build",
}
