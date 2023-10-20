"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOOSApiClient = exports.EnvironmentEnum = void 0;
const tslib_1 = require("tslib");
const api_types_1 = require("./api-types");
const Utilities_1 = require("./utils/Utilities");
const Constants_1 = require("./utils/Constants");
const api_client_1 = tslib_1.__importStar(require("./api-client"));
var EnvironmentEnum;
(function (EnvironmentEnum) {
    EnvironmentEnum["Dev"] = "dev-";
    EnvironmentEnum["QA"] = "qa-";
    EnvironmentEnum["Prod"] = "";
})(EnvironmentEnum || (exports.EnvironmentEnum = EnvironmentEnum = {}));
class SOOSApiClient {
    constructor(environment, apiKey, clientId) {
        this.environment = environment;
        this.apiKey = apiKey;
        this.clientId = clientId;
    }
    createScan({ projectName, commitHash, branch, buildVersion, buildUri, branchUri, integrationType, operatingEnvironment, integrationName, scanType, }) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const client = (0, api_client_1.default)({
                baseUri: (0, Utilities_1.constructBaseApiUrl)(this.environment, Constants_1.SOOS_ANALYSIS_API),
                apiKey: this.apiKey,
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
            const response = yield client.post(`clients/${this.clientId}/scan-types/${scanType}/scans`, body);
            return {
                projectHash: response.data.projectHash,
                branchHash: response.data.branchHash,
                scanId: (_a = response.data.scanId) !== null && _a !== void 0 ? _a : response.data.analysisId,
                reportUrl: response.data.scanUrl,
                scanStatusUrl: response.data.scanStatusUrl,
            };
        });
    }
    uploadManifestFiles({ clientId, projectHash, analysisId, manifestFiles, }) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const client = (0, api_client_1.default)({
                baseUri: (0, Utilities_1.constructBaseApiUrl)(this.environment, Constants_1.SOOS_ANALYSIS_API),
                apiKey: this.apiKey,
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
    startAnalysisScan({ clientId, projectHash, analysisId, }) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const client = (0, api_client_1.default)({
                baseUri: (0, Utilities_1.constructBaseApiUrl)(this.environment, Constants_1.SOOS_ANALYSIS_API),
                apiKey: this.apiKey,
                clientName: "Start Analysis Scan",
            });
            yield client.put(`clients/${clientId}/projects/${projectHash}/analysis/${analysisId}`);
        });
    }
    updateScanStatus({ clientId, projectHash, branchHash, scanType, scanId, status, message, }) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const client = (0, api_client_1.default)({
                baseUri: (0, Utilities_1.constructBaseApiUrl)(this.environment, Constants_1.SOOS_ANALYSIS_API),
                apiKey: this.apiKey,
                clientName: "Update Scan Status",
            });
            yield client.patch(`clients/${clientId}/projects/${projectHash}/branches/${branchHash}/scan-types/${scanType}/scans/${scanId}`, {
                status: status,
                message: message,
            });
        });
    }
    checkAnalysisScanStatus({ reportStatusUrl, }) {
        var _a, _b, _c, _d, _e;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const client = (0, api_client_1.default)({
                baseUri: (0, Utilities_1.constructBaseApiUrl)(this.environment, Constants_1.SOOS_ANALYSIS_API),
                apiKey: this.apiKey,
                clientName: "Check Analysis Scan Status",
            });
            const response = yield client.get(reportStatusUrl);
            const violationCount = (_b = (_a = response.data.violations) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0;
            const vulnerabilityCount = (_d = (_c = response.data.vulnerabilities) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0;
            return {
                status: response.data.status,
                isComplete: api_types_1.CompletedScanStatuses.includes(response.data.status),
                isSuccess: response.data.status === api_types_1.ScanStatus.Finished,
                hasIssues: violationCount > 0 || vulnerabilityCount > 0,
                violations: violationCount,
                vulnerabilities: vulnerabilityCount,
                errors: (_e = response.data.errors) !== null && _e !== void 0 ? _e : [],
            };
        });
    }
}
exports.SOOSApiClient = SOOSApiClient;
exports.default = SOOSApiClient;
