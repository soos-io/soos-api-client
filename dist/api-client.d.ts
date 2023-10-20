import { AxiosError } from "axios";
export declare function isAxiosError<T = unknown, D = unknown>(e: unknown): e is AxiosError<T, D>;
export interface IHttpRequestParameters {
    baseUri: string;
    apiKey: string;
}
export interface IHttpClientParameters extends IHttpRequestParameters {
    clientName: string;
    errorResponseHandler?: (rejectedResponse: any) => void;
}
export interface ICodedMessageModel {
    code: string;
    message: string;
    data: Record<string, string>;
    statusCode: number;
}
export default function createHttpClient({ baseUri, apiKey, errorResponseHandler, }: IHttpClientParameters): import("axios").AxiosInstance;
