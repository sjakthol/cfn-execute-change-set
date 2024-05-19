/* eslint-env mocha */
"use strict";
import { expect } from "chai";

import helpers from "../lib/helpers.js";

describe("helpers module", function () {
  describe("getChangeSetInfoFromInput()", function () {
    const cases = [
      {
        desc: "text input",
        input:
          "arn:aws:cloudformation:eu-west-1:000000000000:changeSet/test/c785c2b0-63fc-11e7-94dc-500c423e34d2	arn:aws:cloudformation:eu-west-1:000000000000:stack/ew1-test/c255f8f0-ed45-11e7-b5d2-500c3cf8288d",
        output: {
          arn: "arn:aws:cloudformation:eu-west-1:000000000000:changeSet/test/c785c2b0-63fc-11e7-94dc-500c423e34d2",
          region: "eu-west-1",
          name: "test",
        },
      },
      {
        desc: "table input",
        input:
          "-----------------------------------------------------------------------------------------------------------------------------\n" +
          "|                                                      CreateChangeSet                                                      |\n" +
          "+---------+-----------------------------------------------------------------------------------------------------------------+\n" +
          "|  Id     |  arn:aws:cloudformation:eu-west-1:000000000000:changeSet/test/c785c2b0-63fc-11e7-94dc-500c423e34d2              |\n" +
          "|  StackId|  arn:aws:cloudformation:eu-west-1:000000000000:stack/ew1-test/c255f8f0-ed45-11e7-b5d2-500c3cf8288d              |\n" +
          "+---------+-----------------------------------------------------------------------------------------------------------------+",
        output: {
          arn: "arn:aws:cloudformation:eu-west-1:000000000000:changeSet/test/c785c2b0-63fc-11e7-94dc-500c423e34d2",
          region: "eu-west-1",
          name: "test",
        },
      },
      {
        desc: "json input",
        input:
          "{\n" +
          '"StackId": "arn:aws:cloudformation:eu-west-1:000000000000:stack/ew1-test/c255f8f0-ed45-11e7-b5d2-500c3cf8288d",\n' +
          '"Id": "arn:aws:cloudformation:eu-west-1:000000000000:changeSet/test/c785c2b0-63fc-11e7-94dc-500c423e34d2"\n' +
          "}",
        output: {
          arn: "arn:aws:cloudformation:eu-west-1:000000000000:changeSet/test/c785c2b0-63fc-11e7-94dc-500c423e34d2",
          region: "eu-west-1",
          name: "test",
        },
      },
      {
        desc: "empty input",
        input: "",
        output: null,
      },
      {
        desc: "whitespace only input",
        input: "\n",
        output: null,
      },
      {
        desc: "text input with control characters",

        input:
          "arn:aws:cloudformation:eu-west-1:000000000000:changeSet/test/c785c2b0-63fc-11e7-94dc-500c423e34d2\x1B[0m\n",
        output: {
          arn: "arn:aws:cloudformation:eu-west-1:000000000000:changeSet/test/c785c2b0-63fc-11e7-94dc-500c423e34d2",
          region: "eu-west-1",
          name: "test",
        },
      },
    ];

    cases.forEach(function (test) {
      it("parses " + test.desc + " correctly", function () {
        expect(helpers.getChangeSetInfoFromInput(test.input)).to.deep.equal(test.output);
      });
    });
  });
});
