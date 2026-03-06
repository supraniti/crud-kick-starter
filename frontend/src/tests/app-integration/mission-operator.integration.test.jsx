import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App, { AUTH_STORAGE_KEY } from "../../app/App.jsx";
import { createApiMock } from "../reference-api-mock.js";
import { resetBrowserState, setPath } from "../test-helpers.js";

beforeEach(() => {
  resetBrowserState();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Mission operator", () => {
  test("submits a mission job from metadata-driven payload controls and renders terminal logs", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/missions");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mission Operator" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Run mission" })).not.toBeDisabled();
      expect(screen.getByLabelText("Remote Id")).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: "Force Failure" })).toBeInTheDocument();
      expect(screen.queryByRole("switch", { name: "Hold Job" })).not.toBeInTheDocument();
    }, { timeout: 5000 });
    const missionSelectInput = screen.getByRole("combobox", { name: "Mission" });
    expect(missionSelectInput).toHaveAttribute("id", "mission-select-input");
    const missionSelectNameInput = document.querySelector('input[name="missionId"]');
    expect(missionSelectNameInput).toBeTruthy();
    expect(missionSelectNameInput).toHaveAttribute("id", "mission-select-input");
    const remoteIdInput = screen.getByLabelText("Remote Id");
    expect(remoteIdInput).toHaveAttribute("id", "mission-payload-field-remoteId-input");
    expect(remoteIdInput).toHaveAttribute("name", "missionPayload.remoteId");
    const shouldFailInput = screen.getByRole("switch", { name: "Force Failure" });
    expect(shouldFailInput).toHaveAttribute("id", "mission-payload-field-shouldFail-switch");
    const shouldFailNameInput = document.querySelector('input[name="missionPayload.shouldFail"]');
    expect(shouldFailNameInput).toBeTruthy();
    expect(shouldFailNameInput).toHaveAttribute("id", "mission-payload-field-shouldFail-switch");

    fireEvent.click(screen.getByRole("button", { name: "Run mission" }));

    await waitFor(() => {
      expect(api.startMissionJob).toHaveBeenCalledWith({
        missionId: "remote-deploy-mission",
        payload: {
          remoteId: null,
          shouldFail: false
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Mission submitted:/i)).toBeInTheDocument();
      expect(screen.getAllByText("succeeded").length).toBeGreaterThan(0);
      const logsField = screen.getByDisplayValue(/Mission job succeeded/i);
      expect(logsField).toBeInTheDocument();
      expect(logsField).toHaveAttribute("id", "mission-job-logs-input");
      expect(logsField).toHaveAttribute("name", "missionJobLogs");
      const resultField = screen.getByLabelText("Result");
      expect(resultField).toHaveAttribute("id", "mission-job-result-input");
      expect(resultField).toHaveAttribute("name", "missionJobResult");
    });
  }, 15000);

  test("surfaces lifecycle-gated mission submission errors deterministically", async () => {
    const api = createApiMock();
    await api.disableModule({
      moduleId: "remotes"
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/missions");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mission Operator" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Run mission" })).not.toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.click(screen.getByRole("button", { name: "Run mission" }));

    await waitFor(() => {
      expect(api.startMissionJob).toHaveBeenCalledWith({
        missionId: "remote-deploy-mission",
        payload: {
          remoteId: null,
          shouldFail: false
        }
      });
      expect(screen.getByText(/MISSION_MODULE_NOT_ENABLED/i)).toBeInTheDocument();
    });
  }, 15000);

  test("surfaces deterministic mission payload validation contracts", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/missions");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mission Operator" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Run mission" })).not.toBeDisabled();
      expect(screen.getByLabelText("Remote Id")).toBeInTheDocument();
    }, { timeout: 5000 });

    fireEvent.change(screen.getByLabelText("Remote Id"), {
      target: {
        value: "   "
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run mission" }));

    await waitFor(() => {
      expect(api.startMissionJob).toHaveBeenCalled();
    });

    const [[missionRequest]] = api.startMissionJob.mock.calls.slice(-1);
    expect(missionRequest).toMatchObject({
      missionId: "remote-deploy-mission",
      payload: {
        shouldFail: false
      }
    });
    expect([null, "   "]).toContain(missionRequest.payload.remoteId);

    if (missionRequest.payload.remoteId === "   ") {
      await waitFor(() => {
        expect(screen.getByText(/MISSION_PAYLOAD_INVALID/i)).toBeInTheDocument();
        expect(screen.getByText(/REMOTE_DEPLOY_PAYLOAD_REMOTE_ID_INVALID/i)).toBeInTheDocument();
      });
      return;
    }

    await waitFor(() => {
      expect(screen.getByText(/Mission submitted:/i)).toBeInTheDocument();
    });
  }, 15000);
});
