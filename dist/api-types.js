"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompletedScanStatuses = exports.ScanStatus = exports.ManifestStatus = exports.PackageManagerType = exports.ScanType = void 0;
var ScanType;
(function (ScanType) {
    ScanType["SCA"] = "Sca";
    ScanType["DAST"] = "Dast";
    ScanType["CSA"] = "Csa";
})(ScanType || (exports.ScanType = ScanType = {}));
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
