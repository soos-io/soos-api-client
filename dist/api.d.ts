import FormData from "form-data";
import { ICodedMessageModel, IHttpRequestParameters } from "./api-client";
export interface IContributingDeveloperAudit {
    source: string | null;
    sourceName: string | null;
    contributingDeveloperId: string | null;
}
interface ICreateAnalysisScanStructureArguments extends IHttpRequestParameters {
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
export declare enum ScanType {
    SCA = "Sca",
    DAST = "Dast",
    CSA = "Csa"
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
export declare function createScan({ baseUri, apiKey, clientId, projectName, commitHash, branch, buildVersion, buildUri, branchUri, integrationType, operatingEnvironment, integrationName, scanType, }: ICreateScanArguments): Promise<ICreateScanReturn>;
export interface IUploadManifestFilesArguments extends IHttpRequestParameters {
    clientId: string;
    projectHash: string;
    branchHash: string;
    analysisId: string;
    manifestFiles: FormData;
}
export declare enum PackageManagerType {
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
    Swift = "Swift"
}
export declare enum ManifestStatus {
    Unknown = "Unknown",
    Valid = "Valid",
    OnlyDevDependencies = "OnlyDevDependencies",
    OnlyLockFiles = "OnlyLockFiles",
    OnlyNonLockFiles = "OnlyNonLockFiles",
    NoPackages = "NoPackages",
    UnknownManifestType = "UnknownManifestType",
    UnsupportedManifestVersion = "UnsupportedManifestVersion",
    ParsingError = "ParsingError",
    Empty = "Empty"
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
export declare function uploadManifestFiles({ baseUri, apiKey, clientId, projectHash, analysisId, manifestFiles, }: IUploadManifestFilesArguments): Promise<IUploadManifestResponse>;
export interface IStartAnalysisArguments extends IHttpRequestParameters {
    clientId: string;
    projectHash: string;
    analysisId: string;
}
export declare function startAnalysisScan({ baseUri, apiKey, clientId, projectHash, analysisId, }: IStartAnalysisArguments): Promise<void>;
export interface ICheckAnalysisScanStatusArguments extends IHttpRequestParameters {
    reportStatusUrl: string;
}
export declare enum ScanStatus {
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
    Error = "Error"
}
export declare const CompletedScanStatuses: ScanStatus[];
export interface ICheckAnalysisScanStatusReturn {
    status: ScanStatus;
    violations: {
        count: number;
    } | null;
    vulnerabilities: {
        count: number;
    } | null;
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
export declare function checkAnalysisScanStatus({ baseUri, apiKey, reportStatusUrl, }: ICheckAnalysisScanStatusArguments): Promise<IAnalysisScanStatus>;
export interface IUpdateScanStatusArguments extends IHttpRequestParameters {
    clientId: string;
    projectHash: string;
    branchHash: string;
    scanType: ScanType;
    scanId: string;
    status: ScanStatus;
    message: string;
}
export declare function updateScanStatus({ baseUri, apiKey, clientId, projectHash, branchHash, scanType, scanId, status, message, }: IUpdateScanStatusArguments): Promise<void>;
export {};
