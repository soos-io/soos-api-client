import axios, { AxiosError } from "axios";
import { soosLogger } from "./logging/SOOSLogger";
import { HashEncodingEnum, IntegrationName, OnFailure, ScanStatus, ScanType } from "./enums";
import fs from "fs";
import crypto from "node:crypto";
import { BinaryToTextEncoding } from "crypto";
import { SOOS_CONSTANTS } from "./constants";

const generatedScanTypes = [ScanType.CSA, ScanType.SBOM, ScanType.SCA];

const isNil = (value: unknown): value is null | undefined => value === null || value === undefined;

const ensureValue = <T>(value: T | null | undefined, propertyName: string): T => {
  if (isNil(value)) throw new Error(`'${propertyName}' is required.`);
  return value;
};

const getEnumOptions = <T, TEnumObject extends Record<string, T> = Record<string, T>>(
  enumObject: TEnumObject,
  excludeDefault?: keyof TEnumObject,
): Array<[string, string | number]> => {
  const options = Object.entries(enumObject) as unknown as Array<[string, string | number]>;
  return excludeDefault === undefined ? options : options.filter((o) => o.at(0) !== excludeDefault);
};

const ensureEnumValue = <T, TEnumObject extends Record<string, T> = Record<string, T>>(
  enumObject: TEnumObject,
  inputValue: string | null | undefined,
  parameterName?: string,
  excludeDefault?: keyof TEnumObject,
  ignoreCase = true,
): T | undefined => {
  if (isNil(inputValue)) {
    return undefined;
  }

  const options = getEnumOptions<T, TEnumObject>(enumObject, excludeDefault);
  const option = options.find(([, value]) => {
    const stringValue = value.toLocaleString();
    return ignoreCase
      ? stringValue.toLocaleLowerCase() === inputValue.toLocaleLowerCase()
      : stringValue === inputValue;
  });

  if (isNil(option)) {
    throw new Error(
      `Invalid value '${inputValue}' for ${
        parameterName ? `'${parameterName}'` : "parameter"
      }. Valid options are: ${options.map(([, value]) => value).join(", ")}.`,
    );
  }

  const [key] = option;
  return enumObject[key] as unknown as T;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isUrlAvailable = async (url: string): Promise<boolean> => {
  const delay = 5000;
  const maxAttempts = 5;
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      soosLogger.info(`Attempt ${attempts + 1} of ${maxAttempts}...`);
      const response = await axios.get(url);
      if (response.status >= 200 && response.status < 300) {
        return true;
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        soosLogger.info(error);
        if (error.response && error.response.status < 500) {
          return true;
        }
      }
      attempts++;
      if (attempts < maxAttempts) await sleep(delay);
    }
  }

  return false;
};

const obfuscateProperties = <T extends Record<string, unknown> = Record<string, unknown>>(
  dictionary: T,
  properties: Array<keyof T>,
  replacement = "*********",
) => {
  return Object.entries(dictionary).reduce<T>((accumulator, [key, value]) => {
    return {
      ...accumulator,
      [key]: properties.includes(key) ? replacement : value,
    };
  }, {} as T);
};

const obfuscateCommandLine = (
  input: string,
  argumentsToObfuscate: string[],
  replacement: string = "*********",
): string => {
  const args = input.match(/(--\w+(?:="[^"]+"|=\S+)?|--\w+|"[^"]+"|\S+)/g) || [];

  const loweredArgumentsToObfuscate = argumentsToObfuscate.map((a) => a.toLocaleLowerCase());

  let obfuscating = false;
  return args
    .map((arg) => {
      if (arg.startsWith("--")) {
        const [key, value] = arg.includes("=") ? arg.split("=") : [arg, undefined];

        if (loweredArgumentsToObfuscate.find((a) => a === key.toLocaleLowerCase())) {
          return value === undefined ? ((obfuscating = true), key) : `${key}=${replacement}`;
        }

        obfuscating = false;
      }

      if (obfuscating) {
        obfuscating = false;
        return replacement;
      }

      return arg;
    })
    .join(" ");
};

const reassembleCommandLine = (argv: string[]): string => {
  const escapeQuotes = (s: string) => s.replace(/"/g, '\\"');
  return argv
    .map((arg) => {
      const [key, value] = arg.split("=", 2);
      const needsQuotes = /[\s"']/.test(value ?? arg);
      if (value !== undefined) {
        return `${key} ${needsQuotes ? `"${escapeQuotes(value)}"` : value}`;
      }

      return needsQuotes ? `"${escapeQuotes(arg)}"` : arg;
    })
    .join(" ");
};

const convertStringToBase64 = (content: string): string => {
  const messageBytes = Buffer.from(content, "utf-8");
  const base64Message = messageBytes.toString("base64");
  return base64Message;
};

const getEnvVariable = (name: string): string | null => {
  return process.env[name] || null;
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";

  const kilobyte = 1024;
  const fractionalDigits = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const exponentialValue = Math.floor(Math.log(bytes) / Math.log(kilobyte));
  const count = Number.parseFloat(
    (bytes / Math.pow(kilobyte, exponentialValue)).toFixed(fractionalDigits),
  );
  const unit = sizes[exponentialValue];
  return `${count} ${unit}`;
};

const generateFileHash = (
  hashAlgorithm: string,
  encoding: HashEncodingEnum,
  digestEncoding: HashEncodingEnum,
  filePath: string,
): string => {
  const bufferEncoding = encoding.toLowerCase() as unknown as BufferEncoding;
  const binaryToTextEncoding = digestEncoding.toLowerCase() as unknown as BinaryToTextEncoding;
  const fileContent = fs.readFileSync(filePath, bufferEncoding);
  return crypto
    .createHash(hashAlgorithm)
    .update(fileContent, bufferEncoding)
    .digest(binaryToTextEncoding);
};

const isScanDone = (scanStatus: ScanStatus): boolean =>
  [ScanStatus.Finished, ScanStatus.FailedWithIssues, ScanStatus.Incomplete, ScanStatus.Error].some(
    (s) => s === scanStatus,
  );

const getAnalysisExitCodeWithMessage = (
  scanStatus: ScanStatus,
  integrationName: IntegrationName,
  onFailure: OnFailure,
): { exitCode: number; message: string } => {
  if (scanStatus === ScanStatus.FailedWithIssues) {
    return {
      exitCode:
        onFailure === OnFailure.Fail ? 1 : integrationName === IntegrationName.AzureDevOps ? 2 : 0,
      message: "Analysis Complete. Issues reported.",
    };
  } else if (scanStatus === ScanStatus.Incomplete) {
    return {
      exitCode:
        onFailure === OnFailure.Fail ? 1 : integrationName === IntegrationName.AzureDevOps ? 2 : 0,
      message: "Analysis Incomplete. It may have been cancelled or superseded by another scan.",
    };
  } else if (scanStatus === ScanStatus.Error) {
    return {
      exitCode: onFailure === OnFailure.Fail ? 1 : 0,
      message:
        "Analysis Error. Please check the logs and/or set the logLevel to DEBUG for more information.",
    };
  }

  return {
    exitCode: 0,
    message: "Analysis Complete.",
  };
};

const checkNodeVersion = (): string => {
  const nodeVersion = process.versions.node;
  if (!nodeVersion.startsWith(SOOS_CONSTANTS.RequiredLtsNodeMajorVersion)) {
    soosLogger.warn(
      `Node ${SOOS_CONSTANTS.RequiredLtsNodeMajorVersion} LTS is recommended. You are using ${nodeVersion}`,
    );
  } else {
    soosLogger.info(`Running with Node ${nodeVersion}`);
  }
  return nodeVersion;
};

const DateUtilities = {
  getDate: (daysAgo: number = 0): Date => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  },
  getDateFromUnixUTC: (unixUTC: number): Date => {
    return new Date(unixUTC * 1000);
  },
  isWithinDateRange(date: Date, minDate: Date): boolean {
    return date >= minDate;
  },
};

const StringUtilities = {
  pluralizeWord: (
    count: number | null | undefined,
    singular: string,
    plural = `${singular}s`,
  ): string => {
    return count === 1 ? singular : plural;
  },
  pluralizeTemplate: (count: number | null, singular: string, plural = `${singular}s`): string => {
    const word = StringUtilities.pluralizeWord(count, singular, plural);
    return `${count ?? 0} ${word}`;
  },
  fromCamelToTitleCase: (str: string): string => {
    const words = str.split(/(?<=[a-z])(?=[A-Z])/g).map((word) => {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
    return words.join(" ");
  },
  areEqual: (
    a: string,
    b: string,
    options?: { locales?: Array<string> } & Intl.CollatorOptions,
  ) => {
    return a.localeCompare(b, options?.locales, options) === 0;
  },
  isEmptyString: (value: string): boolean => {
    return value.trim() === "";
  },
};

export {
  generatedScanTypes,
  isNil,
  ensureValue,
  ensureEnumValue,
  sleep,
  isUrlAvailable,
  obfuscateProperties,
  obfuscateCommandLine,
  reassembleCommandLine,
  convertStringToBase64,
  getEnvVariable,
  formatBytes,
  generateFileHash,
  getAnalysisExitCodeWithMessage,
  getEnumOptions,
  DateUtilities,
  StringUtilities,
  isScanDone,
  checkNodeVersion,
};
