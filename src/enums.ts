export enum PackageManagerType {
  Unknown = "Unknown",
  CFamily = "CFamily",
  Dart = "Dart",
  Erlang = "Erlang",
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
  SCA = "Sca",
  DAST = "Dast",
  CSA = "Csa",
}

export enum LogLevel {
  PASS = 0,
  IGNORE = 1,
  INFO = 2,
  WARN = 3,
  FAIL = 4,
  DEBUG = 5,
  ERROR = 6,
}
