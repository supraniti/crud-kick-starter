import {
  registerReferenceMissionRouteHandlers
} from "../../domains/reference/missions/services/mission-route-registration-domain-service.js";

export function registerReferenceMissionRoutes({
  fastify,
  moduleRegistry,
  missionRegistry,
  serviceRegistry,
  jobRunner,
  jobLogStore,
  toPublicJob,
  pushJobLog
}) {
  registerReferenceMissionRouteHandlers({
    fastify,
    moduleRegistry,
    missionRegistry,
    serviceRegistry,
    jobRunner,
    jobLogStore,
    toPublicJob,
    pushJobLog
  });
}
