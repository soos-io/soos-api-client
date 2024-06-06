import { IntegrationName, OnFailure, ScanStatus } from "./enums";
import {
  isNil,
  ensureValue,
  ensureEnumValue,
  ensureNonEmptyValue,
  getAnalysisExitCodeWithMessage,
  StringUtilities,
  generateFileHash,
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

describe("getAnalysisExitCodeWithMessage", () => {
  test("should return 0 on finished with continue", () => {
    expect(
      getAnalysisExitCodeWithMessage(
        ScanStatus.Finished,
        IntegrationName.SoosCsa,
        OnFailure.Continue,
      ).exitCode,
    ).toBe(0);
  });

  test("should return 0 on finished with fail", () => {
    expect(
      getAnalysisExitCodeWithMessage(ScanStatus.Finished, IntegrationName.SoosSca, OnFailure.Fail)
        .exitCode,
    ).toBe(0);
  });

  test("should return 0 for an Incomplete status with continue", () => {
    expect(
      getAnalysisExitCodeWithMessage(
        ScanStatus.Incomplete,
        IntegrationName.SoosSca,
        OnFailure.Continue,
      ).exitCode,
    ).toBe(0);
  });

  test("should return 1 for an Incomplete status with fail", () => {
    expect(
      getAnalysisExitCodeWithMessage(ScanStatus.Incomplete, IntegrationName.SoosSca, OnFailure.Fail)
        .exitCode,
    ).toBe(1);
  });

  test("should return 0 for an Error status with continue", () => {
    expect(
      getAnalysisExitCodeWithMessage(ScanStatus.Error, IntegrationName.SoosSca, OnFailure.Continue)
        .exitCode,
    ).toBe(0);
  });

  test("should return 1 for an Error status with fail", () => {
    expect(
      getAnalysisExitCodeWithMessage(ScanStatus.Error, IntegrationName.SoosSca, OnFailure.Fail)
        .exitCode,
    ).toBe(1);
  });

  test("should return 0 for a FailedWithIssues status with continue", () => {
    expect(
      getAnalysisExitCodeWithMessage(
        ScanStatus.FailedWithIssues,
        IntegrationName.SoosSca,
        OnFailure.Continue,
      ).exitCode,
    ).toBe(0);
  });

  test("should return 1 for a FailedWithIssues status with fail", () => {
    expect(
      getAnalysisExitCodeWithMessage(
        ScanStatus.FailedWithIssues,
        IntegrationName.SoosSca,
        OnFailure.Fail,
      ).exitCode,
    ).toBe(1);
  });

  test("should return 2 for a FailedWithIssues status with continue when DevOps", () => {
    expect(
      getAnalysisExitCodeWithMessage(
        ScanStatus.FailedWithIssues,
        IntegrationName.AzureDevOps,
        OnFailure.Continue,
      ).exitCode,
    ).toBe(2);
  });

  test("should return 1 for a FailedWithIssues status with fail when DevOps", () => {
    expect(
      getAnalysisExitCodeWithMessage(
        ScanStatus.FailedWithIssues,
        IntegrationName.AzureDevOps,
        OnFailure.Fail,
      ).exitCode,
    ).toBe(1);
  });

  test("should return 2 for an Incomplete status with continue when DevOps", () => {
    expect(
      getAnalysisExitCodeWithMessage(
        ScanStatus.Incomplete,
        IntegrationName.AzureDevOps,
        OnFailure.Continue,
      ).exitCode,
    ).toBe(2);
  });

  test("should return 1 for an Incomplete status with fail when DevOps", () => {
    expect(
      getAnalysisExitCodeWithMessage(
        ScanStatus.Incomplete,
        IntegrationName.AzureDevOps,
        OnFailure.Fail,
      ).exitCode,
    ).toBe(1);
  });
});

describe("StringUtilities.pluralizeWord", () => {
  test("pluralizeWord should return the singular word for a count of 1", () => {
    expect(StringUtilities.pluralizeWord(1, "word")).toBe("word");
  });

  test("pluralizeWord should return the plural word for a count of 0", () => {
    expect(StringUtilities.pluralizeWord(0, "word")).toBe("words");
  });

  test("pluralizeWord should return the plural word for a count of null", () => {
    expect(StringUtilities.pluralizeWord(null, "word")).toBe("words");
  });

  test("pluralizeWord should return the plural word for a count of undefined", () => {
    expect(StringUtilities.pluralizeWord(undefined, "word")).toBe("words");
  });
});

describe("StringUtilities.pluralizeTemplate", () => {
  test("pluralizeTemplate should return the singular word for a count of 1", () => {
    expect(StringUtilities.pluralizeTemplate(1, "word")).toBe("1 word");
  });

  test("pluralizeTemplate should return the plural word for a count of 0", () => {
    expect(StringUtilities.pluralizeTemplate(0, "word")).toBe("0 words");
  });

  test("pluralizeTemplate should return the singular word for a count of null", () => {
    expect(StringUtilities.pluralizeTemplate(null, "word")).toBe("0 words");
  });
});

describe("StringUtilities.fromCamelToTitleCase", () => {
  test("fromCamelToTitleCase should return a title case string", () => {
    expect(StringUtilities.fromCamelToTitleCase("camelCase")).toBe("Camel Case");
  });

  test("fromCamelToTitleCase should return a title case string with multiple words", () => {
    expect(StringUtilities.fromCamelToTitleCase("camelCaseString")).toBe("Camel Case String");
  });
});

describe("StringUtilities.areEqual", () => {
  test("areEqual should return true for equal strings", () => {
    expect(StringUtilities.areEqual("string", "string")).toBe(true);
  });

  test("areEqual should return false for unequal strings", () => {
    expect(StringUtilities.areEqual("string", "other")).toBe(false);
  });

  test("areEqual should return false for unequal strings with different cases", () => {
    expect(StringUtilities.areEqual("string", "STRING")).toBe(false);
  });

  test("areEqual should return true for equal strings with different cases when case is ignored", () => {
    expect(StringUtilities.areEqual("string", "STRING", { sensitivity: "base" })).toBe(true);
  });

  describe("StringUtilities.isEmptyString", () => {
    test("should return true for an empty string", () => {
      expect(StringUtilities.isEmptyString("")).toBe(true);
    });

    test("should return true for a string with only spaces", () => {
      expect(StringUtilities.isEmptyString("   ")).toBe(true);
    });

    test("should return false for a non-empty string", () => {
      expect(StringUtilities.isEmptyString("value")).toBe(false);
    });
  });
});

describe("generateFileDigest", () => {
  test("should generate expected sha1 hash using binary file encoding and hex digest conversion", () => {
    expect(
      generateFileHash("sha1", "binary", "hex", "./testassets/elasticsearch-grok-8.9.1.jar"),
    ).toBe("499f313de5e097fe4db1b623cfb954f18776a88b");
  });
  test("should generate expected sha1 hash using hex file encoding and hex digest conversion", () => {
    expect(
      generateFileHash("sha1", "hex", "hex", "./testassets/elasticsearch-grok-8.9.1.jar"),
    ).toBe("499f313de5e097fe4db1b623cfb954f18776a88b");
  });
  test("should generate expected sha512 hash using binary file encoding and base64 digest conversion", () => {
    expect(generateFileHash("sha512", "binary", "base64", "./testassets/jquery.1.4.2.nupkg")).toBe(
      "FEk/h76zlaEGtK2MPOgA4jfXGOG4DAMc6CI2OtgcL3F3Cp37Ds2VIlXnJXIQZSyURAS+4bVpvrx9r0d2FZCdQQ==",
    );
  });
  test("should generate expected sha512 hash using binary file encoding and base64 digest conversion", () => {
    expect(generateFileHash("sha512", "base64", "base64", "./testassets/jquery.1.4.2.nupkg")).toBe(
      "FEk/h76zlaEGtK2MPOgA4jfXGOG4DAMc6CI2OtgcL3F3Cp37Ds2VIlXnJXIQZSyURAS+4bVpvrx9r0d2FZCdQQ==",
    );
  });
});
