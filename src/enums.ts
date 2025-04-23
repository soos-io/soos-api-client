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
  GitHub = "GitHub",
  GitLab = "GitLab",
  Jenkins = "Jenkins",
  SoosCsa = "SoosCsa",
  SoosDast = "SoosDast",
  SoosSast = "SoosSast",
  SoosSca = "SoosSca",
  SoosSbom = "SoosSbom",
  SoosScmAudit = "SoosScmAudit",
  TeamCity = "TeamCity",
  TravisCI = "TravisCI",
  VisualStudio = "VisualStudio",
  VisualStudioCode = "VisualStudioCode",
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
  AmazonLinux = "AmazonLinux",
  CFamily = "CFamily",
  Dart = "Dart",
  Debian = "Debian",
  Docker = "Docker",
  Erlang = "Erlang",
  Fedora = "Fedora",
  GitHub = "GitHub",
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
  Unity = "Unity",
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
  Duplicate = "Duplicate",
}

export enum ScanStatus {
  Unknown = "Unknown",
  Queued = "Queued",
  NoFiles = "NoFiles",
  Running = "Running",
  LocatingIssues = "LocatingIssues",
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

export enum OnFailure {
  Continue = "continue_on_failure",
  Fail = "fail_the_build",
}

export enum HashAlgorithmEnum {
  Unknown = "Unknown",
  Md5 = "Md5",
  Sha1 = "Sha1",
  Sha256 = "Sha256",
  Sha512 = "Sha512",
}

export enum HashEncodingEnum {
  Utf8 = "Utf8",
  Base64 = "Base64",
  Binary = "Binary",
  Hex = "Hex",
}

export enum FileMatchTypeEnum {
  Manifest = "Manifest",
  FileHash = "FileHash",
  ManifestAndFileHash = "ManifestAndFileHash",
}

export enum AttributionFormatEnum {
  Unknown = "Unknown",
  CsafVex = "CsafVex",
  CycloneDx = "CycloneDx",
  Sarif = "Sarif",
  Spdx = "Spdx",
  SoosIssues = "SoosIssues",
  SoosLicenses = "SoosLicenses",
  SoosPackages = "SoosPackages",
  SoosVulnerabilities = "SoosVulnerabilities",
}

export enum AttributionFileTypeEnum {
  Unknown = "Unknown",
  Csv = "Csv",
  Html = "Html",
  Json = "Json",
  Text = "Text",
  Xml = "Xml",
}

export enum AttributionStatusEnum {
  Unknown = "Unknown",
  Requested = "Requested",
  InProgress = "InProgress",
  Completed = "Completed",
  CompletedWithProblems = "CompletedWithProblems",
  Failed = "Failed",
}
