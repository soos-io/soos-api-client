"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAxiosError = void 0;
const tslib_1 = require("tslib");
const Constants_1 = require("./utils/Constants");
const axios_1 = tslib_1.__importDefault(require("axios"));
function isAxiosError(e) {
    return (e === null || e === void 0 ? void 0 : e.isAxiosError) === true;
}
exports.isAxiosError = isAxiosError;
function createHttpClient({ baseUri, apiKey, errorResponseHandler, }) {
    const client = axios_1.default.create({
        baseURL: baseUri,
        headers: {
            "x-soos-apikey": apiKey,
            "Content-Type": Constants_1.JSON_CONTENT_TYPE,
        },
        maxBodyLength: Constants_1.KILO_BYTE * 5000 * 50,
        maxContentLength: Constants_1.KILO_BYTE * 5000 * 50,
    });
    client.interceptors.request.use((request) => {
        return request;
    }, (rejectedRequest) => {
        return Promise.reject(rejectedRequest);
    });
    client.interceptors.response.use((response) => {
        return response;
    }, (rejectedResponse) => {
        var _a, _b;
        if (rejectedResponse === null || rejectedResponse === void 0 ? void 0 : rejectedResponse.response) {
            if (errorResponseHandler) {
                errorResponseHandler(rejectedResponse);
            }
            else {
                throw new Error(rejectedResponse.response.data.message);
            }
        }
        if (isAxiosError(rejectedResponse)) {
            throw new Error((_b = (_a = rejectedResponse.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message);
        }
        return Promise.reject(rejectedResponse);
    });
    return client;
}
exports.default = createHttpClient;
