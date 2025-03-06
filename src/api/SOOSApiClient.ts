import axios, { AxiosError } from "axios";
import { ICodedMessageModel } from "../models/CodedMessageModel";
import { soosLogger } from "../logging/SOOSLogger";
import { isNil } from "../utilities";

const isAxiosError = <T = unknown, D = unknown>(e: unknown): e is AxiosError<T, D> =>
  (e as AxiosError<T, D>)?.isAxiosError === true;

interface IHttpRequestParameters {
  baseUri: string;
  apiKey: string;
}

interface IHttpClientParameters extends IHttpRequestParameters {
  apiClientName: string;
  skipDebugResponseLogging?: boolean;
  skipDebugRequestLogging?: boolean;
}
class SOOSApiClient {
  private static createHttpClient({
    baseUri,
    apiKey,
    apiClientName,
    skipDebugResponseLogging,
    skipDebugRequestLogging,
  }: IHttpClientParameters) {
    const client = axios.create({
      baseURL: baseUri,
      headers: {
        "x-soos-apikey": apiKey,
        "Content-Type": "application/json",
      },
      // Same as limit on api for manifests
      // Reference: https://stackoverflow.com/a/56868296
      maxBodyLength: 1024 * 5000 * 50,
      maxContentLength: 1024 * 5000 * 50,
    });

    client.interceptors.request.use(
      (request) => {
        if (request.data) {
          soosLogger.debug(
            apiClientName,
            `Request URL: ${request.method?.toLocaleUpperCase()} ${request.url}`,
          );
          if (request.params) {
            soosLogger.debug(apiClientName, `Request Params: ${JSON.stringify(request.params)}`);
          }

          if (!skipDebugRequestLogging) {
            soosLogger.debug(apiClientName, `Request Body: ${JSON.stringify(request.data)}`);
          }
        }
        return request;
      },
      (rejectedRequest) => {
        return Promise.reject(rejectedRequest);
      },
    );

    client.interceptors.response.use(
      (response) => {
        if (skipDebugResponseLogging !== true) {
          soosLogger.debug(apiClientName, `Response Body: ${JSON.stringify(response.data)}`);
        }
        return response;
      },
      (rejectedResponse) => {
        if (isAxiosError<ICodedMessageModel | undefined>(rejectedResponse)) {
          const isCodedMessageModel = !isNil(rejectedResponse.response?.data?.code);
          if (!isCodedMessageModel) {
            switch (rejectedResponse.response?.status) {
              case 403:
                throw new Error(
                  `${apiClientName} ${rejectedResponse.request?.method} ${rejectedResponse.config?.url}: Your request may have been blocked. (Forbidden)`,
                );
              case 503:
                throw new Error(
                  `${apiClientName} ${rejectedResponse.request?.method} ${rejectedResponse.config?.url}: We are down for maintenance. Please try again in a few minutes. (Service Unavailable)`,
                );
              default:
                throw new Error(
                  `${apiClientName} ${rejectedResponse.request?.method} ${rejectedResponse.config?.url}: Unexpected response ${rejectedResponse.response?.status}.`,
                );
            }
          }

          throw new Error(
            `${apiClientName} ${rejectedResponse.request?.method?.toLocaleUpperCase()} ${
              rejectedResponse.config?.url
            }: ${rejectedResponse.response?.data?.message} (${
              rejectedResponse.response?.data?.code
            })`,
          );
        }
        return Promise.reject(rejectedResponse);
      },
    );

    return client;
  }

  public static create(params: IHttpClientParameters) {
    return this.createHttpClient(params);
  }
}

export { isAxiosError };
export default SOOSApiClient;
