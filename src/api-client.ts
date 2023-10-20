import { JSON_CONTENT_TYPE, KILO_BYTE } from "./utils/Constants";
import axios, { AxiosError } from "axios";

export function isAxiosError<T = unknown, D = unknown>(e: unknown): e is AxiosError<T, D> {
  return (e as AxiosError<T, D>)?.isAxiosError === true;
}

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

export default function createHttpClient({
  baseUri,
  apiKey,
  errorResponseHandler,
}: IHttpClientParameters) {
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
      return request;
    },
    (rejectedRequest) => {
      return Promise.reject(rejectedRequest);
    }
  );

  client.interceptors.response.use(
    (response) => {
      return response;
    },
    (rejectedResponse) => {
      if (rejectedResponse?.response) {
        if (errorResponseHandler) {
          errorResponseHandler(rejectedResponse);
        } else {
          throw new Error(rejectedResponse.response.data.message);
        }
      }
      if (isAxiosError<ICodedMessageModel | undefined>(rejectedResponse)) {
        throw new Error(rejectedResponse.response?.data?.message);
      }
      return Promise.reject(rejectedResponse);
    }
  );

  return client;
}
