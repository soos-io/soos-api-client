import { JSON_CONTENT_TYPE, KILO_BYTE } from "../constants";
import axios, { AxiosError } from "axios";
import { ICodedMessageModel } from "../models/Common";

export function isAxiosError<T = unknown, D = unknown>(e: unknown): e is AxiosError<T, D> {
  return (e as AxiosError<T, D>)?.isAxiosError === true;
}

export interface IHttpRequestParameters {
  baseUri: string;
  apiKey: string;
}

export interface IHttpClientParameters extends IHttpRequestParameters {
  apiClientName: string;
}
export class SOOSApiClient {
  private static createHttpClient({ baseUri, apiKey, apiClientName }: IHttpClientParameters) {
    const client = axios.create({
      baseURL: baseUri,
      headers: {
        "x-soos-apikey": apiKey,
        "Content-Type": JSON_CONTENT_TYPE,
      },
      // Same as limit on api for manifests
      // Reference: https://stackoverflow.com/a/56868296
      maxBodyLength: KILO_BYTE * 5000 * 50,
      maxContentLength: KILO_BYTE * 5000 * 50,
    });

    client.interceptors.request.use(
      (request) => {
        if (request.data) {
          logger.verboseDebug(apiClientName, `Request Body: ${JSON.stringify(request.data)}`);
        }
        return request;
      },
      (rejectedRequest) => {
        return Promise.reject(rejectedRequest);
      }
    );

    client.interceptors.response.use(
      (response) => {
        logger.verboseDebug(apiClientName, `Response Body: ${JSON.stringify(response.data)}`);
        return response;
      },
      (rejectedResponse) => {
        if (isAxiosError<ICodedMessageModel | undefined>(rejectedResponse)) {
          throw new Error(
            `${apiClientName} ${rejectedResponse.request?.method} ${rejectedResponse.config?.url}: ${rejectedResponse.response?.data?.message}`
          );
        }
        return Promise.reject(rejectedResponse);
      }
    );

    return client;
  }

  public static create(params: IHttpClientParameters) {
    return this.createHttpClient(params);
  }
}
