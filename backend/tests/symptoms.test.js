const {
  test,
  before,
  after,
  beforeEach,
} = require("node:test");

const assert = require("node:assert/strict");

const mongoose = require("mongoose");

const {
  createTestMongo,
} = require("./helpers/testMongo");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../src/models/User");

const LinkedProfile = require(
  "../src/models/LinkedProfile"
);

const SymptomRecord = require(
  "../src/models/SymptomRecord"
);

let mongod;
let server;
let base;

const password =
  "Symptom test password 123!";

let passwordHash;


// ----------------------------------------------------
// SETUP
// ----------------------------------------------------

before(
  async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "test";

    process.env.JWT_SECRET =
      crypto
        .randomBytes(32)
        .toString("hex");

    process.env.CLIENT_ORIGIN =
      "http://localhost:3000";

    mongod =
      await createTestMongo();

    process.env.MONGO_URI =
      mongod.getUri();

    await mongoose.connect(
      process.env.MONGO_URI
    );

    await Promise.all([
      User.init(),
      LinkedProfile.init(),
      SymptomRecord.init(),
    ]);

    passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    const {
      createApp,
    } = require("../src/app");

    server =
      createApp().listen(
        0,
        "127.0.0.1"
      );

    await new Promise(
      (resolve) =>
        server.once(
          "listening",
          resolve
        )
    );

    base =
      `http://127.0.0.1:${server.address().port}/api`;
  },
  {
    timeout: 240000,
  }
);


after(async () => {
  if (server) {
    await new Promise(
      (resolve) =>
        server.close(resolve)
    );
  }

  await mongoose.disconnect();

  if (mongod) {
    await mongod.stop();
  }
});


beforeEach(async () => {
  await User.deleteMany({});

  await LinkedProfile.deleteMany(
    {}
  );

  await SymptomRecord.deleteMany(
    {}
  );
});


// ----------------------------------------------------
// HELPERS
// ----------------------------------------------------

async function user(
  email = "owner@example.test"
) {
  return User.create({
    name: "Owner",
    email,
    passwordHash,
  });
}


function token(account) {
  return jwt.sign(
    {
      sub: String(account._id),

      ver:
        account.authVersion ||
        0,
    },

    process.env.JWT_SECRET,

    {
      expiresIn: "15m",
    }
  );
}


async function request(
  method,
  path,
  {
    body,
    cookie,
    origin =
      process.env.CLIENT_ORIGIN,
  } = {}
) {
  const response =
    await fetch(
      base + path,
      {
        method,

        headers: {
          "Content-Type":
            "application/json",

          Origin: origin,

          ...(cookie
            ? {
                Cookie:
                  `accessToken=${cookie}`,
              }
            : {}),
        },

        body:
          body === undefined
            ? undefined
            : JSON.stringify(
                body
              ),
      }
    );

  const text =
    await response.text();

  return {
    status:
      response.status,

    body:
      text
        ? JSON.parse(text)
        : null,
  };
}


const urgencyResult = {
  level: "routine",
  label: "Routine / self-care",
  timeframe:
    "Within a few days, if it does not improve",
  action:
    "Rest and monitor your symptoms. Book a regular appointment if they last more than a few days or get worse.",
};


const symptom = {
  description:
    "Mild cough since yesterday",

  urgencyResult,
};


const MISSING_ID =
  "000000000000000000000000";


const forProfile = (
  path,
  profileId
) =>
  `${path}?profileId=${profileId}`;


async function dependent(
  cookie,
  fullName = "Child"
) {
  const created =
    await request(
      "POST",
      "/profile/linked",
      {
        cookie,

        body: {
          fullName,

          dateOfBirth:
            "2015-06-01",

          relationship:
            "child",
        },
      }
    );

  assert.equal(
    created.status,
    201
  );

  return created.body.profile.id;
}


async function add(
  cookie,
  fields = {},
  profileId = "self"
) {
  return request(
    "POST",
    forProfile(
      "/symptoms",
      profileId
    ),
    {
      cookie,

      body: {
        ...symptom,
        ...fields,
      },
    }
  );
}


// ----------------------------------------------------
// AUTHENTICATION
// ----------------------------------------------------

test(
  "every symptom route requires sign-in and writes require our Origin",
  async () => {
    const routes = [
      [
        "GET",
        "/symptoms",
      ],

      [
        "POST",
        "/symptoms",
      ],

      [
        "DELETE",
        `/symptoms/${MISSING_ID}`,
      ],
    ];

    for (
      const [
        method,
        path,
      ] of routes
    ) {
      const response =
        await request(
          method,
          path,
          {
            body:
              method === "GET"
                ? undefined
                : {},
          }
        );

      assert.equal(
        response.status,
        401,
        `${method} ${path}`
      );
    }

    const cookie =
      token(await user());

    const badOrigin =
      await request(
        "POST",
        "/symptoms",
        {
          cookie,

          origin:
            "https://evil.example",

          body: symptom,
        }
      );

    assert.equal(
      badOrigin.status,
      403
    );
  }
);


// ----------------------------------------------------
// CREATE
// ----------------------------------------------------

test(
  "creates a symptom record for my own profile",
  async () => {
    const account =
      await user();

    const cookie =
      token(account);

    const created =
      await add(cookie);

    assert.equal(
      created.status,
      201
    );

    const record =
      created.body
        .symptomRecord;

    assert.ok(record.id);

    assert.equal(
      record.profileId,
      "self"
    );

    assert.equal(
      record.description,
      "Mild cough since yesterday"
    );

    assert.deepEqual(
      record.urgencyResult,
      urgencyResult
    );

    assert.deepEqual(record.conversation.map((message) => message.role), ["patient", "assistant"]);
    assert.match(record.conversation[0].content, /Mild cough/);

    assert.ok(
      record.createdAt
    );

    assert.ok(
      record.updatedAt
    );


    const stored =
      await SymptomRecord.findById(
        record.id
      );

    assert.equal(
      String(stored.owner),
      String(account._id)
    );

    assert.equal(
      String(stored.profileId),
      String(account._id)
    );
  }
);


test("saves patient follow-up answers and the updated assistant response for later review", async () => {
  const cookie = token(await user());
  const created = await add(cookie);
  const id = created.body.symptomRecord.id;
  const updatedResult = {
    level: "urgent",
    label: "Urgent",
    timeframe: "Within a few hours (today)",
    action: "Get seen today at an emergency department or urgent care clinic. Call 140 if it gets worse.",
  };

  const updated = await request("PATCH", `/symptoms/${id}?profileId=self`, {
    cookie,
    body: { answers: { severity: "severe" }, urgencyResult: updatedResult },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.symptomRecord.urgencyResult.level, "urgent");
  assert.equal(updated.body.symptomRecord.conversation.length, 4);
  assert.match(updated.body.symptomRecord.conversation[2].content, /Severe: I can hardly function/);
  assert.match(updated.body.symptomRecord.conversation[3].content, /Urgent/);

  const history = await request("GET", "/symptoms?profileId=self", { cookie });
  assert.equal(history.body.symptomRecords[0].conversation.length, 4);
});

test(
  "owner and profileId in the request body are ignored",
  async () => {
    const account =
      await user();

    const other =
      await user(
        "other@example.test"
      );

    const cookie =
      token(account);

    const created =
      await add(
        cookie,
        {
          owner:
            String(other._id),

          profileId:
            String(other._id),
        }
      );

    assert.equal(
      created.status,
      201
    );

    const stored =
      await SymptomRecord.findById(
        created.body
          .symptomRecord.id
      );

    assert.equal(
      String(stored.owner),
      String(account._id)
    );

    assert.equal(
      String(stored.profileId),
      String(account._id)
    );
  }
);


// ----------------------------------------------------
// LIST
// ----------------------------------------------------

test(
  "lists symptom records newest first",
  async () => {
    const cookie =
      token(await user());

    await add(
      cookie,
      {
        description:
          "First symptom",
      }
    );

    await add(
      cookie,
      {
        description:
          "Second symptom",
      }
    );

    const response =
      await request(
        "GET",
        "/symptoms?profileId=self",
        {
          cookie,
        }
      );

    assert.equal(
      response.status,
      200
    );

    assert.deepEqual(
      response.body
        .symptomRecords
        .map(
          (record) =>
            record.description
        ),

      [
        "Second symptom",
        "First symptom",
      ]
    );
  }
);


// ----------------------------------------------------
// VALIDATION
// ----------------------------------------------------

test(
  "rejects invalid symptom records",
  async () => {
    const cookie =
      token(await user());

    const cases = [
      [
        {
          description: "",
        },
        "Enter a symptom description.",
      ],

      [
        {
          description: "   ",
        },
        "Enter a symptom description.",
      ],

      [
        {
          description: 123,
        },
        "Symptom description must be text.",
      ],

      [
        {
          description:
            "x".repeat(2001),
        },
        "Symptom description must be 2000 characters or fewer.",
      ],

      [
        {
          urgencyResult:
            undefined,
        },
        "A valid urgency result is required.",
      ],

      [
        {
          urgencyResult:
            "routine",
        },
        "A valid urgency result is required.",
      ],

      [
        {
          urgencyResult: [],
        },
        "A valid urgency result is required.",
      ],
      [
        { urgencyResult: { ...urgencyResult, level: "critical" } },
        "A valid urgency result is required.",
      ],
      [
        { urgencyResult: { level: "routine", timeframe: "soon", action: "Wait" } },
        "A valid urgency result is required.",
      ],
      [
        { urgencyResult: { ...urgencyResult, level: "emergency" } },
        "A valid urgency result is required.",
      ],
    ];

    for (
      const [
        fields,
        error,
      ] of cases
    ) {
      const response =
        await add(
          cookie,
          fields
        );

      assert.equal(
        response.status,
        400,
        JSON.stringify(fields)
      );

      assert.equal(
        response.body.error,
        error,
        JSON.stringify(fields)
      );
    }

    assert.equal(
      await SymptomRecord.countDocuments(),
      0
    );
  }
);


// ----------------------------------------------------
// DELETE
// ----------------------------------------------------

test(
  "deletes a symptom record",
  async () => {
    const cookie =
      token(await user());

    const created =
      await add(cookie);

    const id =
      created.body
        .symptomRecord.id;

    const deleted =
      await request(
        "DELETE",
        `/symptoms/${id}?profileId=self`,
        {
          cookie,
        }
      );

    assert.equal(
      deleted.status,
      204
    );

    assert.equal(
      await SymptomRecord.countDocuments(),
      0
    );


    const again =
      await request(
        "DELETE",
        `/symptoms/${id}?profileId=self`,
        {
          cookie,
        }
      );

    assert.equal(
      again.status,
      404
    );
  }
);


// ----------------------------------------------------
// USER OWNERSHIP
// ----------------------------------------------------

test(
  "one user cannot see or delete another user's symptom records",
  async () => {
    const owner =
      token(await user());

    const intruder =
      token(
        await user(
          "intruder@example.test"
        )
      );

    const created =
      await add(owner);

    const id =
      created.body
        .symptomRecord.id;


    const intruderList =
      await request(
        "GET",
        "/symptoms?profileId=self",
        {
          cookie: intruder,
        }
      );

    assert.deepEqual(
      intruderList.body
        .symptomRecords,
      []
    );


    const theirs =
      await request(
        "DELETE",
        `/symptoms/${id}?profileId=self`,
        {
          cookie:
            intruder,
        }
      );

    const missing =
      await request(
        "DELETE",
        `/symptoms/${MISSING_ID}?profileId=self`,
        {
          cookie:
            intruder,
        }
      );

    assert.equal(
      theirs.status,
      404
    );

    assert.deepEqual(
      theirs.body,
      missing.body
    );


    const stored =
      await SymptomRecord.findById(
        id
      );

    assert.ok(stored);
  }
);


// ----------------------------------------------------
// LINKED PROFILE
// ----------------------------------------------------

test(
  "a caregiver can store and read symptom records for a linked profile",
  async () => {
    const account =
      await user();

    const cookie =
      token(account);

    const childId =
      await dependent(cookie);


    await add(
      cookie,
      {
        description:
          "My symptom",
      }
    );


    const childCreated =
      await add(
        cookie,
        {
          description:
            "Child symptom",
        },
        childId
      );


    assert.equal(
      childCreated.status,
      201
    );

    assert.equal(
      childCreated.body
        .symptomRecord
        .profileId,
      childId
    );


    const mine =
      await request(
        "GET",
        "/symptoms?profileId=self",
        {
          cookie,
        }
      );

    assert.deepEqual(
      mine.body
        .symptomRecords
        .map(
          (record) =>
            record.description
        ),

      [
        "My symptom",
      ]
    );


    const childs =
      await request(
        "GET",
        forProfile(
          "/symptoms",
          childId
        ),
        {
          cookie,
        }
      );

    assert.deepEqual(
      childs.body
        .symptomRecords
        .map(
          (record) =>
            record.description
        ),

      [
        "Child symptom",
      ]
    );
  }
);


test(
  "another user cannot access someone else's linked profile",
  async () => {
    const parent =
      token(await user());

    const stranger =
      token(
        await user(
          "stranger@example.test"
        )
      );

    const childId =
      await dependent(parent);

    await add(
      parent,
      {
        description:
          "Private child symptom",
      },
      childId
    );


    for (
      const profileId of [
        childId,
        MISSING_ID,
        "not-an-id",
      ]
    ) {
      const list =
        await request(
          "GET",
          forProfile(
            "/symptoms",
            profileId
          ),
          {
            cookie:
              stranger,
          }
        );

      assert.equal(
        list.status,
        404
      );

      assert.deepEqual(
        list.body,
        {
          error:
            "Profile not found.",
        }
      );
    }
  }
);


// ----------------------------------------------------
// PROFILE SEPARATION
// ----------------------------------------------------

test(
  "a symptom record is only reachable through the profile it belongs to",
  async () => {
    const cookie =
      token(await user());

    const childId =
      await dependent(cookie);


    const mine =
      (
        await add(cookie)
      ).body
        .symptomRecord.id;


    const childs =
      (
        await add(
          cookie,
          {
            description:
              "Child record",
          },
          childId
        )
      ).body
        .symptomRecord.id;


    const wrongChild =
      await request(
        "DELETE",
        forProfile(
          `/symptoms/${childs}`,
          "self"
        ),
        {
          cookie,
        }
      );

    assert.equal(
      wrongChild.status,
      404
    );


    const wrongSelf =
      await request(
        "DELETE",
        forProfile(
          `/symptoms/${mine}`,
          childId
        ),
        {
          cookie,
        }
      );

    assert.equal(
      wrongSelf.status,
      404
    );


    assert.equal(
      await SymptomRecord.countDocuments(),
      2
    );
  }
);


// ----------------------------------------------------
// LOG PRIVACY
// ----------------------------------------------------

test(
  "never writes symptom descriptions to logs",
  async () => {
    const cookie =
      token(await user());

    const secret =
      "UltraPrivateSymptomTextQzWx";


    const written = [];

    const original =
      process.stdout.write;


    process.stdout.write =
      function (
        chunk,
        ...rest
      ) {
        written.push(
          String(chunk)
        );

        return original.call(
          this,
          chunk,
          ...rest
        );
      };


    try {
      await add(
        cookie,
        {
          description:
            secret,
        }
      );

      await request(
        "GET",
        "/symptoms?profileId=self",
        {
          cookie,
        }
      );


      await add(
        cookie,
        {
          description:
            secret.repeat(
              100
            ),
        }
      );
    } finally {
      process.stdout.write =
        original;
    }


    const logs =
      written.join("");


    assert.match(
      logs,
      /http_request/
    );

    assert.ok(
      !logs.includes(
        secret
      ),
      "logs contain symptom text"
    );
  }
);


// ----------------------------------------------------
// RATE LIMIT
// ----------------------------------------------------

test(
  "symptom writes are rate-limited per account",
  async () => {
    const cookie =
      token(await user());


    for (
      let index = 0;
      index < 100;
      index += 1
    ) {
      const response =
        await add(
          cookie,
          {
            description:
              `Symptom ${index}`,
          }
        );

      assert.notEqual(
        response.status,
        429
      );
    }


    const limited =
      await add(
        cookie,
        {
          description:
            "One too many",
        }
      );


    assert.equal(
      limited.status,
      429
    );

    assert.match(
      limited.body.error,
      /Too many changes/
    );


    // Reads are not rate limited.
    const list =
      await request(
        "GET",
        "/symptoms?profileId=self",
        {
          cookie,
        }
      );

    assert.equal(
      list.status,
      200
    );


    // Another account has its own limit.
    const other =
      token(
        await user(
          "second@example.test"
        )
      );

    assert.equal(
      (
        await add(other)
      ).status,
      201
    );
  }
);


// ----------------------------------------------------
// LINKED PROFILE DELETION
// ----------------------------------------------------

test(
  "removing a linked profile deletes its symptom records and nobody else's",
  async () => {
    const cookie =
      token(await user());

    const other =
      token(
        await user(
          "other@example.test"
        )
      );


    const childId =
      await dependent(
        cookie,
        "Child"
      );

    const siblingId =
      await dependent(
        cookie,
        "Sibling"
      );


    await add(
      cookie,
      {
        description:
          "My symptom",
      }
    );


    await add(
      cookie,
      {
        description:
          "Child symptom 1",
      },
      childId
    );

    await add(
      cookie,
      {
        description:
          "Child symptom 2",
      },
      childId
    );


    await add(
      cookie,
      {
        description:
          "Sibling symptom",
      },
      siblingId
    );


    await add(
      other,
      {
        description:
          "Other user's symptom",
      }
    );


    assert.equal(
      await SymptomRecord.countDocuments(
        {
          profileId:
            childId,
        }
      ),
      2
    );


    const deleted =
      await request(
        "DELETE",
        `/profile/linked/${childId}`,
        {
          cookie,
        }
      );


    assert.equal(
      deleted.status,
      204
    );


    assert.equal(
      await SymptomRecord.countDocuments(
        {
          profileId:
            childId,
        }
      ),
      0
    );


    assert.equal(
      await SymptomRecord.countDocuments(),
      3
    );
  }
);


// ----------------------------------------------------
// ACCOUNT DELETION
// ----------------------------------------------------

test(
  "deleting an account deletes all of its symptom records",
  async () => {
    const account =
      await user();

    const cookie =
      token(account);


    const otherAccount =
      await user(
        "other@example.test"
      );

    const other =
      token(otherAccount);


    const childId =
      await dependent(cookie);


    await add(
      cookie,
      {
        description:
          "Owner symptom",
      }
    );


    await add(
      cookie,
      {
        description:
          "Child symptom",
      },
      childId
    );


    await add(
      other,
      {
        description:
          "Other user's symptom",
      }
    );


    const deleted =
      await request(
        "DELETE",
        "/profile/me",
        {
          cookie,

          body: {
            confirm:
              "DELETE",

            password,
          },
        }
      );


    assert.equal(
      deleted.status,
      204
    );


    assert.equal(
      await SymptomRecord.countDocuments(
        {
          owner:
            account._id,
        }
      ),
      0
    );


    assert.equal(
      await SymptomRecord.countDocuments(
        {
          profileId:
            childId,
        }
      ),
      0
    );


    // Other user's health data remains.
    assert.equal(
      await SymptomRecord.countDocuments(),
      1
    );
  }
);
