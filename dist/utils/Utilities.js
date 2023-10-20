"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.constructBaseApiUrl = exports.isNil = void 0;
function isNil(value) {
    return value === null || value === undefined;
}
exports.isNil = isNil;
function constructBaseApiUrl(environment, api) {
    return `https://${environment}${api}`;
}
exports.constructBaseApiUrl = constructBaseApiUrl;
