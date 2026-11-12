import axios from "axios";
import { getOnboardingSettings, saveOnboardingSettings } from "./onboarding";

jest.mock("axios", () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        put: jest.fn(),
    },
}));

beforeEach(() => {
    localStorage.setItem("userData", JSON.stringify({ token: "session-token", username: "owner" }));
    axios.get.mockReset();
    axios.put.mockReset();
});

test("loads saved prompts for the requested project from the API envelope", async () => {
    const data = {
        settings: { ice_breakers: ["Pricing"], slash_commands: [{ command: "/help", description: "" }] },
        provider: "aisensy",
    };
    axios.get.mockResolvedValue({ data: { success: true, data } });

    await expect(getOnboardingSettings("project-123")).resolves.toEqual(data);
    expect(axios.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/onboarding\/settings$/),
        expect.objectContaining({ params: { project_id: "project-123" } })
    );
});

test("saves prompt settings as a plain project-scoped JSON body", async () => {
    const payload = {
        project_id: "project-123",
        ice_breakers: ["Pricing"],
        slash_commands: [{ command: "/help", description: "" }],
    };
    const data = { settings: payload, capabilities: { ice_breakers: true, slash_commands: true } };
    axios.put.mockResolvedValue({ data: { success: true, data } });

    await expect(saveOnboardingSettings(payload)).resolves.toEqual(data);
    expect(axios.put).toHaveBeenCalledWith(
        expect.stringMatching(/\/onboarding\/settings$/),
        payload,
        expect.objectContaining({
            headers: expect.objectContaining({ token: "session-token", username: "owner" }),
        })
    );
});
