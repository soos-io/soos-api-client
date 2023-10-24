import { ICodedMessageModel } from "./Common";
import FormData from "form-data";
import { ManifestStatus, PackageManagerType, ScanStatus, ScanType } from "../enums";

export interface IAnalysisScanStatus extends Pick<ICheckAnalysisScanStatusReturn, "status"> {
  isComplete: boolean;
  isSuccess: boolean;
  hasIssues: boolean;
  violations: number;
  vulnerabilities: number;
  errors: ICodedMessageModel[];
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

export interface ICheckAnalysisScanStatusArguments {
  reportStatusUrl: string;
}

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

export const CompletedScanStatuses = [
  ScanStatus.Error,
  ScanStatus.Incomplete,
  ScanStatus.FailedWithIssues,
  ScanStatus.Finished,
];

export interface IContributingDeveloperAudit {
  source: string | null;
  sourceName: string | null;
  contributingDeveloperId: string | null;
}

export interface ICreateAnalysisScanStructureArguments {
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

export interface ICreateScanArguments extends ICreateAnalysisScanStructureArguments {
  scanType: ScanType;
}

export interface ICreateScanReturn {
  projectHash: string;
  branchHash: string;
  scanId: string;
  reportUrl: string;
  scanStatusUrl: string;
}

export interface ICreateScanArguments extends ICreateAnalysisScanStructureArguments {
  scanType: ScanType;
}

export interface ICreateScanReturn {
  projectHash: string;
  branchHash: string;
  scanId: string;
  reportUrl: string;
  scanStatusUrl: string;
}

export interface ICreateScanArguments extends ICreateAnalysisScanStructureArguments {
  scanType: ScanType;
}

export interface ICreateScanReturn {
  projectHash: string;
  branchHash: string;
  scanId: string;
  reportUrl: string;
  scanStatusUrl: string;
}

export interface ICreateScanArguments extends ICreateAnalysisScanStructureArguments {
  scanType: ScanType;
}

export interface ICreateScanReturn {
  projectHash: string;
  branchHash: string;
  scanId: string;
  reportUrl: string;
  scanStatusUrl: string;
}

export interface ICreateScanArguments extends ICreateAnalysisScanStructureArguments {
  scanType: ScanType;
}

export interface ICreateScanReturn {
  projectHash: string;
  branchHash: string;
  scanId: string;
  reportUrl: string;
  scanStatusUrl: string;
}

export interface ICreateScanArguments extends ICreateAnalysisScanStructureArguments {
  scanType: ScanType;
}

export interface ICreateScanReturn {
  projectHash: string;
  branchHash: string;
  scanId: string;
  reportUrl: string;
  scanStatusUrl: string;
}

export interface IStartAnalysisArguments {
  clientId: string;
  projectHash: string;
  analysisId: string;
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

interface IUploadManifestResponseManifest {
  name: string;
  filename: string;
  packageManager: PackageManagerType;
  status: ManifestStatus;
  statusMessage: string;
}

export interface IUploadManifestFilesArguments {
  clientId: string;
  projectHash: string;
  branchHash: string;
  analysisId: string;
  manifestFiles: FormData;
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
