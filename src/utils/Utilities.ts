import { EnvironmentEnum } from "../soosApiClient";

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function constructBaseApiUrl(environment: EnvironmentEnum, api: string): string {
  return `https://${environment}${api}`;
}
