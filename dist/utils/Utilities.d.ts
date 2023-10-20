import { EnvironmentEnum } from "../soosApiClient";
export declare function isNil(value: unknown): value is null | undefined;
export declare function constructBaseApiUrl(environment: EnvironmentEnum, api: string): string;
