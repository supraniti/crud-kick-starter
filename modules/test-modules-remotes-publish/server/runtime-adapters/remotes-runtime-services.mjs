import {
  listRemoteDeployPayloadFields,
  validateRemoteDeployPayload
} from "../../../../server/src/domains/reference/contracts/remote-config/local-contract/remote-deploy-mission-contract.mjs";

export function registerServices({ registry }) {
  registry.register({
    serviceId: "remote-deploy-connector",
    moduleId: "remotes",
    service: {
      label: "Remote Deploy Connector",
      description: "Provides normalized remote deployment connector metadata."
    }
  });
}

export function registerMissions({ registry }) {
  registry.register({
    missionId: "remote-deploy-mission",
    moduleId: "remotes",
    mission: {
      label: "Remote Deploy Mission",
      description: "Executes deployment missions against configured remotes.",
      payload: {
        fields: listRemoteDeployPayloadFields()
      },
      validatePayload: validateRemoteDeployPayload,
      execute: async (payload = {}, context = {}) => {
        const remoteId = typeof payload.remoteId === "string" ? payload.remoteId : null;
        context.log?.("info", "Remote deploy mission handler executed", {
          remoteId,
          shouldFail: payload.shouldFail === true
        });

        if (payload.shouldFail === true) {
          const error = new Error("Remote deploy mission failed");
          error.code = "REMOTE_DEPLOY_MISSION_FAILED";
          throw error;
        }

        return {
          ok: true,
          remoteId,
          simulated: true
        };
      }
    }
  });
}
