import { IntegrationName, OnFailure, ScanStatus } from "./enums";
import {
  isNil,
  ensureValue,
  ensureEnumValue,
  ensureNonEmptyValue,
  getAnalysisExitCode,
} from "./utilities";

describe("isNil", () => {
  test("should return true for null", () => {
    expect(isNil(null)).toBe(true);
  });

  test("should return true for undefined", () => {
    expect(isNil(undefined)).toBe(true);
  });

  test("should return false for a non-nil value", () => {
    expect(isNil("string")).toBe(false);
  });
});

describe("ensureValue", () => {
  test("should throw an error for null", () => {
    expect(() => ensureValue(null, "property")).toThrow("'property' is required.");
  });

  test("should throw an error for undefined", () => {
    expect(() => ensureValue(undefined, "property")).toThrow("'property' is required.");
  });

  test("should return the value for a non-nil value", () => {
    expect(ensureValue("value", "property")).toBe("value");
  });
});

describe("ensureNonEmptyValue", () => {
  test("should throw an error for null", () => {
    expect(() => ensureNonEmptyValue(null, "property")).toThrow("'property' is required.");
  });

  test("should throw an error for undefined", () => {
    expect(() => ensureNonEmptyValue(undefined, "property")).toThrow("'property' is required.");
  });

  test("should throw an error for an empty string", () => {
    expect(() => ensureNonEmptyValue("", "property")).toThrow("'property' is required.");
  });

  test("should throw an error for a string with only spaces", () => {
    expect(() => ensureNonEmptyValue("   ", "property")).toThrow("'property' is required.");
  });

  test("should return the value for a non-empty string", () => {
    expect(ensureNonEmptyValue("value", "property")).toBe("value");
  });
});

describe("ensureEnumValue", () => {
  test("should return undefined for null", () => {
    expect(ensureEnumValue({ value: "value" }, null)).toBe(undefined);
  });

  test("should return undefined for undefined", () => {
    expect(ensureEnumValue({ value: "value" }, undefined)).toBe(undefined);
  });

  test("should throw an error for an invalid enum value", () => {
    expect(() => ensureEnumValue({ value: "value" }, "invalid")).toThrow(
      "Invalid value 'invalid' for parameter. Valid options are: value.",
    );
  });

  test("should throw an error for an invalid enum value with parameterName", () => {
    expect(() => ensureEnumValue({ value: "value" }, "invalid", "parameterName")).toThrow(
      "Invalid value 'invalid' for 'parameterName'. Valid options are: value.",
    );
  });

  test("should return the enum value for a valid enum value", () => {
    expect(ensureEnumValue({ value: "value" }, "value")).toBe("value");
  });

  test("should return the enum value for a valid enum value with different case", () => {
    expect(ensureEnumValue({ value: "value" }, "VALUE")).toBe("value");
  });
});

describe("getAnalysisExitCode", () => {
  test("should exit with code 0", () => {
    expect(
      getAnalysisExitCode(ScanStatus.Finished, IntegrationName.SoosSca, OnFailure.Continue),
    ).toBe(0);
  });

  test("should return 0 for an Incomplete status on continue on failure", () => {
    expect(
      getAnalysisExitCode(ScanStatus.Incomplete, IntegrationName.SoosSca, OnFailure.Continue),
    ).toBe(0);
  });

  test("should return 1 for an Error status on fail", () => {
    expect(getAnalysisExitCode(ScanStatus.Error, IntegrationName.SoosSca, OnFailure.Fail)).toBe(1);
  });

  test("should return 2 for a FailedWithIssues status on continue with Azure Devops", () => {
    expect(
      getAnalysisExitCode(
        ScanStatus.FailedWithIssues,
        IntegrationName.AzureDevOps,
        OnFailure.Continue,
      ),
    ).toBe(2);
  });

  test("should return 0 for a FailedWithIssues status without azure devops", () => {
    expect(
      getAnalysisExitCode(ScanStatus.FailedWithIssues, IntegrationName.SoosSca, OnFailure.Continue),
    ).toBe(0);
  });
});
