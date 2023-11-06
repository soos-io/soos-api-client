import axios, { AxiosError } from "axios";
import { soosLogger } from "./logging/SOOSLogger";
const isNil = (value: unknown): value is null | undefined => value === null || value === undefined;

const ensureValue = <T>(value: T | null | undefined, propertyName: string): T => {
  if (isNil(value)) throw new Error(`'${propertyName}' is required.`);
  return value;
};

const ensureValueIsOneOf = <T extends string>(
  options: Array<T>,
  value: string | undefined,
  opts: { caseSensitive?: boolean } = {},
): T | undefined => {
  if (value === undefined) return undefined;
  const match = options.find((option) => {
    return opts.caseSensitive
      ? option === value
      : option.toLocaleLowerCase() === value.toLocaleLowerCase();
  });
  if (!isNil(match)) return match;
  throw new Error(`Invalid enum value '${value}'. Valid options are: ${options.join(", ")}.`);
};

const ensureEnumValue = <
  T extends string,
  TEnumObject extends Record<string, T> = Record<string, T>,
>(
  enumObject: TEnumObject,
  value: string | undefined,
): T | undefined => {
  return ensureValueIsOneOf(Object.values(enumObject), value);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isUrlAvailable = async (url: string): Promise<boolean> => {
  let delay = 5000;
  let maxAttempts = 5;
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

function convertStringToB64(content: string): string {
  const messageBytes = Buffer.from(content, "utf-8");
  const base64Message = messageBytes.toString("base64");
  return base64Message;
}

const getEnvVariable = (name: string): string | null => {
  return process.env[name] || null;
};

export {
  isNil,
  ensureValue,
  ensureValueIsOneOf,
  ensureEnumValue,
  sleep,
  isUrlAvailable,
  obfuscateProperties,
  convertStringToB64,
  getEnvVariable,
};
