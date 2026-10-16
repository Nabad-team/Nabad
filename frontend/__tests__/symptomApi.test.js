import {
  addSymptomRecord,
  getSymptomsForProfile,
  deleteSymptomRecord,
} from "../lib/symptomApi";

import { request } from "../lib/api";

jest.mock("../lib/api", () => ({
  request: jest.fn(),
}));

describe("symptomApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("saving a symptom uses the backend and clears old localStorage symptom data", async () => {
    localStorage.setItem(
      "nabad-symptom-records",
      JSON.stringify([
        {
          symptoms: "old chest pain",
        },
      ])
    );

    request.mockResolvedValue({
      symptomRecord: {
        id: "record-1",
        profileId: "self",
        description: "headache and fever",
        urgencyResult: {
          level: "soon",
        },
      },
    });

    const result = await addSymptomRecord(
      "self",
      "Karim",
      "headache and fever",
      {
        level: "soon",
      }
    );

    expect(request).toHaveBeenCalledWith(
      "/symptoms?profileId=self",
      {
        method: "POST",
        body: JSON.stringify({
          description: "headache and fever",
          urgencyResult: {
            level: "soon",
          },
        }),
      }
    );

    expect(
      localStorage.getItem(
        "nabad-symptom-records"
      )
    ).toBeNull();

    expect(result).toMatchObject({
      id: "record-1",
      profileName: "Karim",
      symptoms: "headache and fever",
    });
  });

  test("linked profile symptoms use that profileId in the backend request", async () => {
    request.mockResolvedValue({
      symptomRecords: [
        {
          id: "record-2",
          profileId: "profile-123",
          description: "cough",
          urgencyResult: {
            level: "routine",
          },
        },
      ],
    });

    const records =
      await getSymptomsForProfile(
        "profile-123"
      );

    expect(request).toHaveBeenCalledWith(
      "/symptoms?profileId=profile-123"
    );

    expect(records).toEqual([
      {
        id: "record-2",
        profileId: "profile-123",
        description: "cough",
        urgencyResult: {
          level: "routine",
        },
        symptoms: "cough",
      },
    ]);
  });

  test("deleting a symptom uses the backend and does not store health data in localStorage", async () => {
    request.mockResolvedValue({});

    await deleteSymptomRecord(
      "profile-123",
      "record-7"
    );

    expect(request).toHaveBeenCalledWith(
      "/symptoms/record-7?profileId=profile-123",
      {
        method: "DELETE",
      }
    );

    expect(
      localStorage.getItem(
        "nabad-symptom-records"
      )
    ).toBeNull();
  });
});