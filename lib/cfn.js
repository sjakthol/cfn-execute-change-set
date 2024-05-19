"use strict";
import {
  DescribeChangeSetCommand,
  DescribeStacksCommand,
  ExecuteChangeSetCommand,
} from "@aws-sdk/client-cloudformation";
import helpers from "./helpers.js";

/**
 * Describe the given changeset & stack. Waits for creation to complete
 * before returning a value.
 *
 * @param {Object} info parsed changeset info object
 */
async function describeChangeSet(info) {
  const cfn = helpers.getCloudFormationClient({ region: info.region });
  while (true) {
    const data = await cfn.send(new DescribeChangeSetCommand({ ChangeSetName: info.arn }));
    if (data.Status === "FAILED") {
      if (data.StatusReason.match(/didn't contain changes/)) {
        const stackData = await cfn.send(new DescribeStacksCommand({ StackName: data.StackId }));
        return { stack: stackData.Stacks[0], changeset: data };
      }
      return Promise.reject(new Error("Failed to create change set: " + data.StatusReason));
    }

    if (data.Status === "CREATE_COMPLETE") {
      const stackData = await cfn.send(new DescribeStacksCommand({ StackName: data.StackId }));
      return { stack: stackData.Stacks[0], changeset: data };
    }

    console.log("Changeset is being created. Waiting...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

/**
 * @param {import('@aws-sdk/client-cloudformation').DescribeChangeSetOutput} changeset
 */
async function executeChangeSet(changeset) {
  const info = helpers.getChangeSetInfoFromInput(changeset.ChangeSetId);
  const cfn = helpers.getCloudFormationClient({ region: info.region });
  try {
    await cfn.send(new ExecuteChangeSetCommand({ ChangeSetName: info.arn }));
  } catch (err) {
    console.error(`Failed to execute change set: ${JSON.stringify(err, null, 2)}`);
    return false;
  }

  console.log("Stack update started:");
  console.log(`- Change Set ARN: ${changeset.ChangeSetId}`);
  console.log(`- Stack ARN: ${changeset.StackId}`);

  return true;
}

export default {
  describeChangeSet,
  executeChangeSet,
};
