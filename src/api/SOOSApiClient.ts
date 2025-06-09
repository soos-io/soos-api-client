import axios from "axios";
import { soosLogger } from "../logging/SOOSLogger";

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

    client.interceptors.request.use((request) => {
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
    });

    client.interceptors.response.use(
      (response) => {
        if (skipDebugResponseLogging !== true) {
          soosLogger.debug(apiClientName, `Response Body: ${JSON.stringify(response.data)}`);
        }
        return response;
      },
      (error) => {
        if (axios.isAxiosError(error)) {
          const { config, response } = error;
          if (config && response) {
            // API ICodedMessageModel
            if (
              response.status !== 401 &&
              response.data &&
              response.data.code &&
              response.data.message &&
              (response.status !== 403 ||
                [
                  "ClientLimitRequired",
                  "InvalidClientContext",
                  "InvalidLicense",
                  "LicenseExpired",
                  "LicenseScanTypeRequired",
                  "TrialExpired",
                ].includes(response.data.code))
            ) {
              throw new Error(
                `${response.data.message} (${response.status} ${response.data.code} - ${apiClientName} - ${config.method} ${config.url})`,
                error,
              );
            }

            switch (response.status) {
              case 401:
                throw new Error(
                  `Please Verify your API Key and Client ID. (Unauthorized - ${apiClientName} - ${config.method} ${config.url})`,
                );
              case 403:
                throw new Error(
                  `Please Verify your API Key and Client ID, ensuring they align with an appropriate Role within SOOS to run scans. (Forbidden - ${apiClientName} - ${config.method} ${config.url})`,
                );
              case 429:
                throw new Error(
                  `You have been rate limited. (TooManyRequests - ${apiClientName} - ${config.method} ${config.url})`,
                );
              case 502:
                throw new Error(
                  `Unable to connect to SOOS. Please verify your connection and try again in a few minutes. (BadGateway - ${apiClientName} - ${config.method} ${config.url})`,
                );
              case 503:
                throw new Error(
                  `We are down for maintenance. Please try again in a few minutes. (ServiceUnavailable - ${apiClientName} - ${config.method} ${config.url})`,
                );
            }

            throw new Error(
              `Unexpected error response. (${response.status} - ${apiClientName} - ${config.method} ${config.url})`,
            );
          }
        } else if (error.code && error.message) {
          throw new Error(`An unexpected coded error occurred: ${error.code} ${error.message}`);
        } else if (error.message) {
          throw new Error(`An unexpected error occurred: ${error.message}`, error);
        }

        return Promise.reject(error);
      },
    );

    return client;
  }

  public static create(params: IHttpClientParameters) {
    return this.createHttpClient(params);
  }
}

export default SOOSApiClient;
