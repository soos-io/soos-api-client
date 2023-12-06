import axios, { AxiosError } from "axios";
import { soosLogger } from "./logging/SOOSLogger";
import StringUtilities from "./StringUtilities";
import { ScanStatus } from "./enums";

const isNil = (value: unknown): value is null | undefined => value === null || value === undefined;

const ensureValue = <T>(value: T | null | undefined, propertyName: string): T => {
  if (isNil(value)) throw new Error(`'${propertyName}' is required.`);
  return value;
};

const ensureNonEmptyValue = (value: string | null | undefined, propertyName: string): string => {
  if (isNil(value) || StringUtilities.isEmptyString(value))
    throw new Error(`'${propertyName}' is required.`);
  return value;
};

const ensureEnumValue = <T, TEnumObject extends Record<string, T> = Record<string, T>>(
  enumObject: TEnumObject,
  inputValue: string | null | undefined,
  excludeDefault?: keyof TEnumObject,
  ignoreCase = true,
): T | undefined => {
  if (isNil(inputValue)) {
    return undefined;
  }

  const options = Object.entries(enumObject) as unknown as Array<[string, string | number]>;
  const optionsWithoutExcludedDefault =
    excludeDefault === undefined ? options : options.filter((o) => o.at(0) !== excludeDefault);
  const option = optionsWithoutExcludedDefault.find(([, value]) => {
    const stringValue = value.toLocaleString();
    return ignoreCase
      ? stringValue.toLocaleLowerCase() === inputValue.toLocaleLowerCase()
      : stringValue === inputValue;
  });

  if (isNil(option)) {
    throw new Error(
      `Invalid enum value '${inputValue}'. Valid options are: ${options
        .map(([, value]) => value)
        .join(", ")}.`,
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

const verifyScanStatus = (scanStatus: ScanStatus): boolean => {
  let fail = false;
  if (scanStatus === ScanStatus.FailedWithIssues) {
    soosLogger.warn("Analysis complete - Failures reported");
    fail = true;
  } else if (scanStatus === ScanStatus.Incomplete) {
    soosLogger.warn(
      "Analysis Incomplete. It may have been cancelled or superseded by another scan.",
    );
    fail = true;
  } else if (scanStatus === ScanStatus.Error) {
    soosLogger.warn("Analysis Error.");
    fail = true;
  }

  if (fail) {
    soosLogger.warn("Failing the build.");
  }

  return fail;
};

export {
  isNil,
  ensureValue,
  ensureEnumValue,
  ensureNonEmptyValue,
  sleep,
  isUrlAvailable,
  obfuscateProperties,
  convertStringToBase64,
  getEnvVariable,
  formatBytes,
  verifyScanStatus,
};
