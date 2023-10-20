import FormData from "form-data";
import { ICodedMessageModel } from "./api-client";

export interface IContributingDeveloperAudit {
  source: string | null;
  sourceName: string | null;
  contributingDeveloperId: string | null;
}

interface ICreateAnalysisScanStructureArguments {
  clientId: string;
  projectName: string;
  commitHash: string | null;
  branch: string | null;
  buildVersion: string | null;
  buildUri: string | null;
  branchUri: string | null;
  integrationType: string;
  operatingEnvironment: string;
  integrationName: string;
  appVersion: string;
}

export enum ScanType {
  SCA = "Sca",
  DAST = "Dast",
  CSA = "Csa",
}

export interface ICreateScanArguments extends ICreateAnalysisScanStructureArguments {
  scanType: ScanType;
}

export interface IApiCreateScanRequestBody {
  projectName: string;
  commitHash: string | null;
  branch: string | null;
  buildVersion: string | null;
  buildUri: string | null;
  branchUri: string | null;
  integrationType: string;
  operatingEnvironment: string;
  integrationName: string | null;
  contributingDeveloperAudit?: IContributingDeveloperAudit[];
}

export interface IApiCreateScanResponseBody {
  clientHash: string;
  projectHash: string;
  branchHash: string;
  scanId: string | null;
  analysisId: string;
  scanType: string;
  scanUrl: string;
  scanStatusUrl: string;
  errors: ICodedMessageModel[] | null;
}

export interface ICreateScanReturn {
  projectHash: string;
  branchHash: string;
  scanId: string;
  reportUrl: string;
  scanStatusUrl: string;
}

export interface IUploadManifestFilesArguments {
  clientId: string;
  projectHash: string;
  branchHash: string;
  analysisId: string;
  manifestFiles: FormData;
}

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

interface IUploadManifestResponseManifest {
  name: string;
  filename: string;
  packageManager: PackageManagerType;
  status: ManifestStatus;
  statusMessage: string;
}

export interface IUploadManifestResponse {
  message: string;
  manifests?: Array<IUploadManifestResponseManifest> | undefined;
}

export interface IUploadResponseError extends ICodedMessageModel {
  validManifestCount: number;
  invalidManifestCount: number;
  manifests: Array<{
    name: string;
    filename: string;
    packageManager: PackageManagerType;
    status: string;
    statusMessage: string;
  }>;
}

export interface IStartAnalysisArguments {
  clientId: string;
  projectHash: string;
  analysisId: string;
}
export interface ICheckAnalysisScanStatusArguments {
  reportStatusUrl: string;
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

export const CompletedScanStatuses = [
  ScanStatus.Error,
  ScanStatus.Incomplete,
  ScanStatus.FailedWithIssues,
  ScanStatus.Finished,
];

export interface ICheckAnalysisScanStatusReturn {
  status: ScanStatus;
  violations: { count: number } | null;
  vulnerabilities: { count: number } | null;
  clientHash: string;
  projectHash: string;
  branchHash: string;
  scanId: string;
  analysisId: string;
  scanType: string;
  scanUrl: string;
  scanStatusUrl: string;
  errors: ICodedMessageModel[] | null;
}

export interface IAnalysisScanStatus extends Pick<ICheckAnalysisScanStatusReturn, "status"> {
  isComplete: boolean;
  isSuccess: boolean;
  hasIssues: boolean;
  violations: number;
  vulnerabilities: number;
  errors: ICodedMessageModel[];
}
export interface IUpdateScanStatusArguments {
  clientId: string;
  projectHash: string;
  branchHash: string;
  scanType: ScanType;
  scanId: string;
  status: ScanStatus;
  message: string;
}
