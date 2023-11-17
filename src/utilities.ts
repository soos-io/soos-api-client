import axios, { AxiosError } from "axios";
import { soosLogger } from "./logging/SOOSLogger";
const isNil = (value: unknown): value is null | undefined => value === null || value === undefined;

const isEmptyString = (value: string): boolean => {
  return value.trim() === "";
};

const ensureValue = <T>(value: T | null | undefined, propertyName: string): T => {
  if (isNil(value)) throw new Error(`'${propertyName}' is required.`);
  return value;
};

const ensureNonEmptyValue = (value: string, propertyName: string): string => {
  if (isEmptyString(value)) throw new Error(`'${propertyName}' is required.`);
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

export {
  isNil,
  isEmptyString,
  ensureValue,
  ensureEnumValue,
  ensureNonEmptyValue,
  sleep,
  isUrlAvailable,
  obfuscateProperties,
  convertStringToBase64,
  getEnvVariable,
};
