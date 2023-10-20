import { IAnalysisScanStatus, ICheckAnalysisScanStatusArguments, ICreateScanArguments, ICreateScanReturn, IStartAnalysisArguments, IUpdateScanStatusArguments, IUploadManifestFilesArguments, IUploadManifestResponse } from "./api-types";
export declare enum EnvironmentEnum {
    Dev = "dev-",
    QA = "qa-",
    Prod = ""
}
export declare class SOOSApiClient {
    private readonly environment;
    private readonly apiKey;
    private readonly clientId;
    constructor(environment: EnvironmentEnum, apiKey: string, clientId: string);
    createScan({ projectName, commitHash, branch, buildVersion, buildUri, branchUri, integrationType, operatingEnvironment, integrationName, scanType, }: ICreateScanArguments): Promise<ICreateScanReturn>;
    uploadManifestFiles({ clientId, projectHash, analysisId, manifestFiles, }: IUploadManifestFilesArguments): Promise<IUploadManifestResponse>;
    startAnalysisScan({ clientId, projectHash, analysisId, }: IStartAnalysisArguments): Promise<void>;
    updateScanStatus({ clientId, projectHash, branchHash, scanType, scanId, status, message, }: IUpdateScanStatusArguments): Promise<void>;
    checkAnalysisScanStatus({ reportStatusUrl, }: ICheckAnalysisScanStatusArguments): Promise<IAnalysisScanStatus>;
}
export default SOOSApiClient;
