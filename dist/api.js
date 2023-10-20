"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateScanStatus = exports.checkAnalysisScanStatus = exports.CompletedScanStatuses = exports.ScanStatus = exports.startAnalysisScan = exports.uploadManifestFiles = exports.ManifestStatus = exports.PackageManagerType = exports.createScan = exports.ScanType = void 0;
const tslib_1 = require("tslib");
const Utilities_1 = require("./utils/Utilities");
const api_client_1 = tslib_1.__importStar(require("./api-client"));
var ScanType;
(function (ScanType) {
    ScanType["SCA"] = "Sca";
    ScanType["DAST"] = "Dast";
    ScanType["CSA"] = "Csa";
})(ScanType || (exports.ScanType = ScanType = {}));
function createScan({ baseUri, apiKey, clientId, projectName, commitHash, branch, buildVersion, buildUri, branchUri, integrationType, operatingEnvironment, integrationName, scanType, }) {
    var _a;
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const client = (0, api_client_1.default)({
            baseUri,
            apiKey,
            clientName: "Create Scan",
        });
        const body = {
            projectName: projectName,
            commitHash: commitHash,
            branch: branch,
            buildVersion: buildVersion,
            buildUri: buildUri,
            branchUri: branchUri,
            integrationType: integrationType,
            operatingEnvironment: operatingEnvironment,
            integrationName: integrationName,
        };
        const response = yield client.post(`clients/${clientId}/scan-types/${scanType}/scans`, body);
        return {
            projectHash: response.data.projectHash,
            branchHash: response.data.branchHash,
            scanId: (_a = response.data.scanId) !== null && _a !== void 0 ? _a : response.data.analysisId,
            reportUrl: response.data.scanUrl,
            scanStatusUrl: response.data.scanStatusUrl,
        };
    });
}
exports.createScan = createScan;
var PackageManagerType;
(function (PackageManagerType) {
    PackageManagerType["Unknown"] = "Unknown";
    PackageManagerType["CFamily"] = "CFamily";
    PackageManagerType["Dart"] = "Dart";
    PackageManagerType["Erlang"] = "Erlang";
    PackageManagerType["Go"] = "Go";
    PackageManagerType["Homebrew"] = "Homebrew";
    PackageManagerType["Java"] = "Java";
    PackageManagerType["NPM"] = "NPM";
    PackageManagerType["NuGet"] = "NuGet";
    PackageManagerType["Php"] = "Php";
    PackageManagerType["Python"] = "Python";
    PackageManagerType["Ruby"] = "Ruby";
    PackageManagerType["Rust"] = "Rust";
    PackageManagerType["Swift"] = "Swift";
})(PackageManagerType || (exports.PackageManagerType = PackageManagerType = {}));
var ManifestStatus;
(function (ManifestStatus) {
    ManifestStatus["Unknown"] = "Unknown";
    ManifestStatus["Valid"] = "Valid";
    ManifestStatus["OnlyDevDependencies"] = "OnlyDevDependencies";
    ManifestStatus["OnlyLockFiles"] = "OnlyLockFiles";
    ManifestStatus["OnlyNonLockFiles"] = "OnlyNonLockFiles";
    ManifestStatus["NoPackages"] = "NoPackages";
    ManifestStatus["UnknownManifestType"] = "UnknownManifestType";
    ManifestStatus["UnsupportedManifestVersion"] = "UnsupportedManifestVersion";
    ManifestStatus["ParsingError"] = "ParsingError";
    ManifestStatus["Empty"] = "Empty";
})(ManifestStatus || (exports.ManifestStatus = ManifestStatus = {}));
function uploadManifestFiles({ baseUri, apiKey, clientId, projectHash, analysisId, manifestFiles, }) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const client = (0, api_client_1.default)({
            baseUri,
            apiKey,
            clientName: "Upload  Container Files",
            errorResponseHandler: (rejectedResponse) => {
                var _a, _b;
                if ((0, api_client_1.isAxiosError)(rejectedResponse)) {
                    if (((_b = (_a = rejectedResponse.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.code) === "NoManifestsAccepted") {
                        throw new Error(rejectedResponse.response.data.message);
                    }
                }
            },
        });
        const headers = yield new Promise((resolve) => manifestFiles.getLength((error, length) => (0, Utilities_1.isNil)(error) && !(0, Utilities_1.isNil)(length)
            ? resolve(manifestFiles.getHeaders({ "Content-Length": length.toString() }))
            : resolve(manifestFiles.getHeaders())));
        const response = yield client.post(`clients/${clientId}/projects/${projectHash}/analysis/${analysisId}/manifests`, manifestFiles, {
            headers: headers,
        });
        return response.data;
    });
}
exports.uploadManifestFiles = uploadManifestFiles;
function startAnalysisScan({ baseUri, apiKey, clientId, projectHash, analysisId, }) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const client = (0, api_client_1.default)({ baseUri, apiKey, clientName: "Start Analysis Scan" });
        yield client.put(`clients/${clientId}/projects/${projectHash}/analysis/${analysisId}`);
    });
}
exports.startAnalysisScan = startAnalysisScan;
var ScanStatus;
(function (ScanStatus) {
    ScanStatus["Unknown"] = "Unknown";
    ScanStatus["Queued"] = "Queued";
    ScanStatus["Manifest"] = "Manifest";
    ScanStatus["LocatingDependencies"] = "LocatingDependencies";
    ScanStatus["LoadingPackageDetails"] = "LoadingPackageDetails";
    ScanStatus["LocatingVulnerabilities"] = "LocatingVulnerabilities";
    ScanStatus["RunningGovernancePolicies"] = "RunningGovernancePolicies";
    ScanStatus["Finished"] = "Finished";
    ScanStatus["FailedWithIssues"] = "FailedWithIssues";
    ScanStatus["Incomplete"] = "Incomplete";
    ScanStatus["Error"] = "Error";
})(ScanStatus || (exports.ScanStatus = ScanStatus = {}));
exports.CompletedScanStatuses = [
    ScanStatus.Error,
    ScanStatus.Incomplete,
    ScanStatus.FailedWithIssues,
    ScanStatus.Finished,
];
function checkAnalysisScanStatus({ baseUri, apiKey, reportStatusUrl, }) {
    var _a, _b, _c, _d, _e;
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const client = (0, api_client_1.default)({ baseUri, apiKey, clientName: "Check Analysis Scan Status" });
        const response = yield client.get(reportStatusUrl);
        const violationCount = (_b = (_a = response.data.violations) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0;
        const vulnerabilityCount = (_d = (_c = response.data.vulnerabilities) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0;
        return {
            status: response.data.status,
            isComplete: exports.CompletedScanStatuses.includes(response.data.status),
            isSuccess: response.data.status === ScanStatus.Finished,
            hasIssues: violationCount > 0 || vulnerabilityCount > 0,
            violations: violationCount,
            vulnerabilities: vulnerabilityCount,
            errors: (_e = response.data.errors) !== null && _e !== void 0 ? _e : [],
        };
    });
}
exports.checkAnalysisScanStatus = checkAnalysisScanStatus;
function updateScanStatus({ baseUri, apiKey, clientId, projectHash, branchHash, scanType, scanId, status, message, }) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const client = (0, api_client_1.default)({ baseUri, apiKey, clientName: "Update Scan Status" });
        yield client.patch(`clients/${clientId}/projects/${projectHash}/branches/${branchHash}/scan-types/${scanType}/scans/${scanId}`, {
            status: status,
            message: message,
        });
    });
}
exports.updateScanStatus = updateScanStatus;
